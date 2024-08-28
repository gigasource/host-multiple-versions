import express from 'express';
import path from 'path';
import { downloadVersion, listVersions } from './services/versionServices';
import { initializeDatabase } from './utils/dbUtils';
import fs from 'fs/promises';
import dotenv from "dotenv";

const app = express();
const PORT = 3000;
dotenv.config();

async function modifyBundleFile(distPath: string): Promise<void> {
    const indexHtmlPath = path.join(distPath, 'index.html');
    const indexHtmlContent = await fs.readFile(indexHtmlPath, 'utf-8');

    // Find the bundle.js file name
    const bundleMatch = indexHtmlContent.match(/<script src="(.+?\.bundle\.js)"><\/script>/);
    if (!bundleMatch) {
        console.warn('Bundle.js file not found in index.html');
        return;
    }

    const bundleFileName = bundleMatch[1];
    const bundlePath = path.join(distPath, bundleFileName);
    const mapPath = bundlePath + '.map';
    console.log(bundlePath)
    // Read and modify the bundle.js file
    let bundleContent = await fs.readFile(bundlePath, 'utf-8');
    // Remove leading slash from image paths
    bundleContent = bundleContent.replace(/(?<!url\(['"]{0,1})\/([^"]+\.(png|svg))/g, '$1');    // Write the modified content back to the file
    await fs.writeFile(bundlePath, bundleContent, "utf-8");
    console.log(`Modified ${bundleFileName}`);

    // Find occurrences of r.avatar and change them to r.avatar.slice(1)
    bundleContent = bundleContent.replace(/r\.avatar\)/g, 'r.avatar.slice(1))');

    // Write the modified content back to the file
    await fs.writeFile(bundlePath, bundleContent, 'utf-8');
    console.log('Modified r.avatar occurrences in the bundle.js file');

}

async function setupStaticServer() {
    await initializeDatabase();

    app.use('/demo.pos/:version', async (req, res, next) => {
        const version = req.params.version;
        try {
            const versionPath = await downloadVersion(version);
            const appPath = path.join(versionPath, 'resources', 'app', 'dist');

            console.log(appPath)
            await modifyBundleFile(appPath);
            express.static(appPath)(req, res, next);

        } catch (error) {
            res.status(404).send('Version not found');
        }
    });

    app.get('/', async (req, res) => {
        try {
            const versions = await listVersions();
            const versionLinks = versions.map(v => `<li><a href="/demo.pos/${v.version}">${v.version}</a></li>`).join('');
            res.send(`
        <h1>Welcome to the Version Manager</h1>
        <p>Available versions:</p>
        <ul>${versionLinks}</ul>
      `);
        } catch (error) {
            res.status(500).send('Error fetching versions');
        }
    });

    app.listen(PORT, () => {
        console.log(`Static server running on http://localhost:${PORT}`);
    });
}

setupStaticServer().catch(console.error);
