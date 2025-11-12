import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function testCameraConnection(rtspUrl: string, username?: string, password?: string): Promise<boolean> {
  try {
    // Build authenticated URL if credentials provided
    let url = rtspUrl;
    if (username && password) {
      const urlParts = rtspUrl.split('://');
      if (urlParts.length === 2) {
        const encodedUsername = encodeURIComponent(username);
        const encodedPassword = encodeURIComponent(password);
        url = `${urlParts[0]}://${encodedUsername}:${encodedPassword}@${urlParts[1]}`;
      }
    }

    // Use ffprobe to gently test connection
    const cmd = `ffprobe -v error -show_entries stream=codec_name,width,height,rate -of csv=p=0 "${url}"`;
    
    await execAsync(cmd, {
      timeout: 15000 // 15 second timeout for test
    });
    
    console.log(`Camera connection test successful for: ${rtspUrl}`);
    return true;
  } catch (error) {
    console.log(`Camera connection test failed for: ${rtspUrl} - ${(error as Error).message}`);
    return false;
  }
}