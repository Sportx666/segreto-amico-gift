import { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

export function versionPlugin(): Plugin {
  return {
    name: 'version-json-plugin',
    apply: 'build',
    closeBundle() {
      const now = new Date();
      const version = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '');
      
      const versionInfo = {
        version: now.toISOString().slice(0, 16).replace('T', ' '),
        timestamp: now.getTime()
      };

      const distPath = path.resolve(process.cwd(), 'dist');
      const versionPath = path.resolve(distPath, 'version.json');
      
      // Ensure dist directory exists
      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath, { recursive: true });
      }
      
      fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));
      console.log(`[VersionPlugin] Generated version.json: ${versionInfo.version}`);
    }
  };
}
