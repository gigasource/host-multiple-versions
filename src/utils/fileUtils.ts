import fs from 'fs';
import axios from 'axios';

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
