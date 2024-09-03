import express from 'express';
import path from 'path';
import { downloadVersion, listVersions } from './services/versionServices';
import { initializeDatabase } from './utils/dbUtils';
import fs from 'fs';
import dotenv from "dotenv";

const app = express();
const PORT = 3000;
dotenv.config();

function modifyBundleFile(distPath: string) {
    try {
        console.log(`Starting to modify bundle file in ${distPath}`);

        const indexHtmlPath = path.join(distPath, 'index.html');
        if (!fs.existsSync(indexHtmlPath)) {
            throw new Error(`index.html not found at ${indexHtmlPath}`);
        }

        const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
        console.log('Successfully read index.html');

        const bundleMatch = indexHtmlContent.match(/<script src="(.+?\.bundle\.js)"><\/script>/);
        if (!bundleMatch) {
            throw new Error('Bundle.js file not found in index.html');
        }

        const bundleFileName = bundleMatch[1];
        const bundlePath = path.join(distPath, bundleFileName);
        if (!fs.existsSync(bundlePath)) {
            throw new Error(`Bundle file not found at ${bundlePath}`);
        }

        console.log(`Found bundle file: ${bundlePath}`);

        let bundleContent = fs.readFileSync(bundlePath, 'utf-8');
        console.log('Successfully read bundle.js');

        // Remove leading slash from image paths
        const originalLength = bundleContent.length;
        bundleContent = bundleContent.replace(/(?<!url\(['"]{0,1})\/([^"]+\.(png|svg))/g, '$1');
        console.log(`Modified image paths. Characters changed: ${originalLength - bundleContent.length}`);

        // Modify r.avatar occurrences
        const avatarRegex = /r\.avatar\)/g;
        const avatarMatches = bundleContent.match(avatarRegex);
        bundleContent = bundleContent.replace(avatarRegex, 'r.avatar.slice(1))');
        console.log(`Modified ${avatarMatches ? avatarMatches.length : 0} r.avatar occurrences`);

        // Write the modified content back to the file
        fs.writeFileSync(bundlePath, bundleContent, "utf-8");
        console.log(`Successfully wrote modified content back to ${bundleFileName}`);

        console.log('Bundle modification completed successfully');
    } catch (error) {
        console.error('Error in modifyBundleFile:');
        throw error; // Re-throw the error so the calling function knows modification failed
    }
}

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
