const ffmpegPath = "/snap/bin/ffmpeg"; // Adjust the path accordingly
const ffprobePath = "/snap/bin/ffmpeg.ffprobe"; // Adjust the path accordingly
const filePath = '/home/dhruv/Desktop/server/database/videos/4444dhruv@gmail.com/0db05ad6-9813-4709-bde7-84817d3d7b97/03f35a22-f801-408d-833c-e8b71955d179.mp4';

const ffmpeg = require('fluent-ffmpeg');
const ffprobe = ffmpeg(filePath).setFfprobePath(ffprobePath);

ffprobe.ffprobe((err, data) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('Data:', data);
    }
});
