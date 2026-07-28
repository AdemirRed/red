const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs').promises;

// Configurar ffmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

class ThumbnailGenerator {
    constructor() {
        this.thumbnailsDir = path.join(__dirname, 'public', 'thumbnails');
        this.initThumbnailsDir();
    }

    async initThumbnailsDir() {
        try {
            await fs.access(this.thumbnailsDir);
        } catch {
            await fs.mkdir(this.thumbnailsDir, { recursive: true });
        }
    }

    async generateImageThumbnail(inputPath, outputPath, width = 200, height = 200) {
        try {
            await sharp(inputPath)
                .resize(width, height, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 80 })
                .toFile(outputPath);
            
            return true;
        } catch (error) {
            console.error('Erro ao gerar thumbnail de imagem:', error);
            return false;
        }
    }

    async generateVideoThumbnail(inputPath, outputPath, width = 200, height = 200) {
        return new Promise((resolve) => {
            ffmpeg(inputPath)
                .screenshots({
                    count: 1,
                    timemarks: ['10%'],
                    size: `${width}x${height}`,
                    filename: path.basename(outputPath)
                })
                .on('end', () => {
                    console.log('Thumbnail de vídeo gerado com sucesso');
                    resolve(true);
                })
                .on('error', (err) => {
                    console.error('Erro ao gerar thumbnail de vídeo:', err);
                    resolve(false);
                })
                .save(path.dirname(outputPath));
        });
    }

    async generateThumbnail(filePath, fileId, mimeType) {
        const thumbnailName = `thumb_${fileId}.jpg`;
        const thumbnailPath = path.join(this.thumbnailsDir, thumbnailName);
        
        try {
            // Verificar se já existe
            await fs.access(thumbnailPath);
            return `/thumbnails/${thumbnailName}`;
        } catch {
            // Não existe, gerar novo
        }

        let success = false;
        
        if (mimeType.startsWith('image/')) {
            success = await this.generateImageThumbnail(filePath, thumbnailPath);
        } else if (mimeType.startsWith('video/')) {
            success = await this.generateVideoThumbnail(filePath, thumbnailPath);
        }

        if (success) {
            return `/thumbnails/${thumbnailName}`;
        }
        
        return null;
    }

    getDefaultIcon(mimeType) {
        if (mimeType.startsWith('image/')) return 'fas fa-image';
        if (mimeType.startsWith('video/')) return 'fas fa-video';
        if (mimeType.startsWith('audio/')) return 'fas fa-music';
        if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
        if (mimeType.includes('word') || mimeType.includes('document')) return 'fas fa-file-word';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fas fa-file-powerpoint';
        if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'fas fa-file-archive';
        return 'fas fa-file';
    }
}

module.exports = ThumbnailGenerator;
