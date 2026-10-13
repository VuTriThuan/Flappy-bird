import { mkdir, copyFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
await mkdir('vendor-bin',{recursive:true});
for (const [source,name] of [[ffmpeg,process.platform==='win32'?'ffmpeg.exe':'ffmpeg'],[ffprobe.path,process.platform==='win32'?'ffprobe.exe':'ffprobe']]) {
  if (!source) throw Error(`Không tìm thấy ${name}`);
  const dest=join('vendor-bin',name);await copyFile(source,dest);if(process.platform!=='win32')await chmod(dest,0o755);
}
