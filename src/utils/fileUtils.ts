import fs from 'fs';
import axios from 'axios';
import path from "path";

export const modifyBundleFile = (distPath: string) => {
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
        bundleContent = bundleContent.replace(/(?<!url\(['"]?)\/([^"]+\.(png|svg))/g, '$1');
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

export const downloadFile = async (url: string, outputPath: string): Promise<void> => {
    console.log("Start downloading");
    const writer = fs.createWriteStream(outputPath);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
};
