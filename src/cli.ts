import { Command } from 'commander';
import { initializeDatabase } from './utils/dbUtils';
import { listVersions, downloadVersion } from './services/versionServices';
import dotenv from "dotenv";

dotenv.config();

const program = new Command();

program
    .name('version-manager')
    .description('CLI to manage app versions')
    .version('1.0.0');

program
    .command('list')
    .description('List all app versions')
    .action(async () => {
        try {
            await initializeDatabase();
            const versions = await listVersions();
            console.table(versions);
        } catch (error) {
            console.error('Error listing versions:', error);
        } finally {
            process.exit();
        }
    });

program
    .command('download <version>')
    .description('Download a specific version')
    .action(async (version) => {
        try {
            await initializeDatabase();
            const filePath = await downloadVersion(version);
            console.log(`Version ${version} downloaded to: ${filePath}`);
        } catch (error) {
            console.error('Error downloading version:', error);
        } finally {
            process.exit();
        }
    });

program.parse(process.argv);
