import { Emitter } from "surrealdb.js";
import { retrieveRemoteVersion } from "surrealdb.js";
import type { RpcRequest, RpcResponse } from "surrealdb.js";
import { ConnectionUnavailable, HttpConnectionError, MissingNamespaceDatabase } from "surrealdb.js";
import { z } from "zod";
import { getIncrementalID } from "./getIncrementalID";
import { decodeCbor, encodeCbor } from "surrealdb.js";
import { ConnectionStatus, Engine, type EngineEvents } from "surrealdb.js";

export class HttpEngine implements Engine {
    ready: Promise<void> | undefined = undefined;
    status: ConnectionStatus = ConnectionStatus.Disconnected;
    readonly emitter: Emitter<EngineEvents>;
    connection: {
        url?: URL;
        namespace?: string;
        database?: string;
        token?: string;
        variables: Record<string, unknown>;
    } = { variables: {} };

    constructor(emitter: Emitter<EngineEvents>) {
        this.emitter = emitter;
    }

    private setStatus<T extends ConnectionStatus>(
        status: T,
        ...args: EngineEvents[T]
    ) {
        this.status = status;
        this.emitter.emit(status, args);
    }

    version(url: URL, timeout: number): Promise<string> {
        return retrieveRemoteVersion(url, timeout);
    }

    connect(url: URL) {
        this.setStatus(ConnectionStatus.Connecting);
        this.connection.url = url;
        this.setStatus(ConnectionStatus.Connected);
        this.ready = new Promise<void>((r) => r());
        return this.ready;
    }

    disconnect(): Promise<void> {
        this.connection = { variables: {} };
        this.ready = undefined;
        this.setStatus(ConnectionStatus.Disconnected);
        return new Promise<void>((r) => r());
    }

    async rpc<
        Method extends string,
        Params extends unknown[] | undefined,
        Result extends unknown,
    >(request: RpcRequest<Method, Params>): Promise<RpcResponse<Result>> {
        await this.ready;
        if (!this.connection.url) {
            throw new ConnectionUnavailable();
        }

        if (request.method == "use") {
            const [namespace, database] = z.tuple([z.string(), z.string()])
                .parse(request.params);
            if (namespace) this.connection.namespace = namespace;
            if (database) this.connection.database = database;
            return {
                result: true as Result,
            };
        }

        if (request.method == "let") {
            const [key, value] = z.tuple([z.string(), z.unknown()]).parse(
                request.params,
            );
            this.connection.variables[key] = value;
            return {
                result: true as Result,
            };
        }

        if (request.method == "unset") {
            const [key] = z.tuple([z.string()]).parse(request.params);
            delete this.connection.variables[key];
            return {
                result: true as Result,
            };
        }

        if (request.method == "query") {
            request.params = [
                request.params?.[0],
                {
                    ...this.connection.variables,
                    ...(request.params?.[1] ?? {}),
                },
            ] as Params;
        }

        if (!this.connection.namespace || !this.connection.database) {
            throw new MissingNamespaceDatabase();
        }

        const id = getIncrementalID();
        const raw = await fetch(`${this.connection.url}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/cbor",
                Accept: "application/cbor",
                "Surreal-NS": this.connection.namespace,
                "Surreal-DB": this.connection.database,
                ...(this.connection.token
                    ? { Authorization: `Bearer ${this.connection.token}` }
                    : {}),
            },
            body: encodeCbor({ id, ...request }),
        });

        const buffer = await raw.arrayBuffer();

        if (raw.status == 200) {
            const response: RpcResponse = decodeCbor(buffer);
            if ("result" in response) {
                switch (request.method) {
                    case "signin":
                    case "signup": {
                        this.connection.token = response.result as string;
                        break;
                    }

                    case "authenticate": {
                        this.connection.token = request.params?.[0] as string;
                        break;
                    }

                    case "invalidate": {
                        delete this.connection.token;
                        break;
                    }
                }
            }

            this.emitter.emit(`rpc-${id}`, [response]);
            return response as RpcResponse<Result>;
        } else {
            const dec = new TextDecoder("utf-8");
            throw new HttpConnectionError(
                dec.decode(buffer),
                raw.status,
                raw.statusText,
                buffer,
            );
        }
    }

    get connected() {
        return !!this.connection.url;
    }
}
