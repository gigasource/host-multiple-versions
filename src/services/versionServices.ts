import fs from 'fs';
import {readdir} from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import { getSurrealDbInterface } from '../utils/dbUtils';
import { downloadFile } from '../utils/fileUtils';


const TEMP_DIR = path.join(process.cwd(), 'temp');

interface AppRelease {
    downloadUrl: string;
    version: string;
    downloaded: boolean;
}

export async function listVersions(): Promise<AppRelease[]> {
    const appReleaseDb = getSurrealDbInterface('app_releases');

    try {
        // Fetch releases from the database
        const releases = await appReleaseDb.find() as AppRelease[];

        // Get folder names from the temp directory
        let tempVersions: string[] = [];
        try {
            const tempFolders = await readdir(TEMP_DIR, { withFileTypes: true });
            tempVersions = tempFolders
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
        } catch (error) {
            console.warn('Error reading temp directory:', error);
        }

        // Combine database releases with temp folder versions and add downloaded flag
        const combinedReleases: AppRelease[] = releases.map(release => ({
            ...release,
            downloaded: tempVersions.includes(release.version)
        }));

        // Add versions from temp that are not in the database
        for (const tempVersion of tempVersions) {
            if (!combinedReleases.some(release => release.version === tempVersion)) {
                combinedReleases.push({
                    version: tempVersion,
                    downloadUrl: `temp/${tempVersion}`,
                    downloaded: true
                });
            }
        }

        // Sort releases by version (assuming semver-like versioning)
        combinedReleases.sort((a, b) =>
            b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' })
        );

        return combinedReleases;
    } catch (error) {
        console.error('Error fetching versions:', error);
        throw error;
    }
}

export async function downloadVersion(version: string): Promise<string> {
    const appReleaseDb = getSurrealDbInterface('app_releases');
    const extractPath = path.join(TEMP_DIR, version);

    try {
        // Check if the version directory already exists in temp folder
        try {
            await fs.promises.access(extractPath);
            console.log(`Version ${version} already exists in temp folder. Skipping download.`);
            return extractPath;
        } catch (err) {
            // Directory does not exist in temp, proceed with checking SurrealDB
        }

        // Try to find the release in SurrealDB
        const [release] = await appReleaseDb.find(`WHERE version = "${version}"`) as AppRelease[];

        if (!release) {
            throw new Error(`Version ${version} not found in SurrealDB or temp folder`);
        }

        const zipPath = path.join(TEMP_DIR, `${version}.zip`);

        // Check if zip file already exists
        try {
            await fs.promises.access(zipPath);
            console.log(`Zip file for version ${version} already exists. Skipping download.`);
        } catch (zipErr) {
            // Zip file does not exist, proceed with download
            await downloadFile(release.downloadUrl, zipPath);
        }

        // Unzip the file
        console.log("Start unzipping");
        await unzipFile(zipPath, extractPath);

        // Optionally remove the zip file
        // await fs.unlink(zipPath);

        return extractPath;
    } catch (error) {
        console.error(`Error downloading version ${version}:`, error);
        throw error;
    }
}

async function unzipFile(zipPath: string, extractPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractPath, true);
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}
