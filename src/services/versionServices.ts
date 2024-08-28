import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { getSurrealDbInterface } from '../utils/dbUtils';
import { downloadFile } from '../utils/fileUtils';


const TEMP_DIR = path.join(process.cwd(), 'temp');

interface AppRelease {
    downloadUrl: string;
    version: string;
}

export async function listVersions(): Promise<AppRelease[]> {
    const appReleaseDb = getSurrealDbInterface('app_releases');

    try {
        const releases = await appReleaseDb.find() as AppRelease[];
        return releases.map(({ version, downloadUrl }) => ({ version, downloadUrl}));
    } catch (error) {
        console.error('Error fetching versions:', error);
        throw error;
    }
}
export async function downloadVersion(version: string): Promise<string> {
    const appReleaseDb = getSurrealDbInterface('app_releases');

    try {
        const [release] = await appReleaseDb.find(`WHERE version = "${version}"`) as AppRelease[];
        if (!release) {
            throw new Error(`Version ${version} not found`);
        }
        const extractPath = path.join(TEMP_DIR, version);

        // Check if the version directory already exists
        try {
            await fs.promises.access(extractPath);
            console.log(`Version ${version} already exists. Skipping download.`);
            return extractPath;
        } catch (err) {
            // Directory does not exist, proceed with download
            const zipPath = path.join(TEMP_DIR, `${version}.zip`);
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

            // Remove the zip file
            // fs.unlinkSync(zipPath);

            return extractPath;
        }
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
