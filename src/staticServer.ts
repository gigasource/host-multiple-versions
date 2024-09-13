import express from 'express';
import path from 'path';
import { downloadVersion, listVersions } from './services/versionServices';
import { initializeDatabase } from './utils/dbUtils';
import  { modifyBundleFile } from './utils/fileUtils'
import dotenv from "dotenv";

const app = express();
const PORT = 3000;
dotenv.config();

async function setupStaticServer() {
    await initializeDatabase();

    app.use('/demo.pos/:version', async (req, res, next) => {
        const version = req.params.version;
        try {
            const versionPath = await downloadVersion(version);
            const appPath = path.join(versionPath, 'resources', 'app', 'dist');

            console.log(appPath)
            modifyBundleFile(appPath);
            express.static(appPath)(req, res, next);

        } catch (error) {
            res.status(404).send('Version not found');
        }
    });

    app.get('/', async (req, res) => {
        try {
            const versions = await listVersions();

            const versionLinks = versions.map(v => {
                const downloadedText = v.downloaded ? ' (downloaded)' : '';
                return `<li><a href="/demo.pos/${v.version}" target="_blank" rel="noopener noreferrer">${v.version}</a>${downloadedText}</li>`;
            }).join('');

            res.send(`
            <h1>Welcome to the Version Manager</h1>
            <p>Available versions:</p>
            <ul>${versionLinks}</ul>
        `);
        } catch (error) {
            console.error('Error in route handler:', error);
            res.status(500).send('Error fetching versions');
        }
    });

    app.listen(PORT, () => {
        console.log(`Static server running on http://localhost:${PORT}`);
    });
}

setupStaticServer().catch(console.error);
