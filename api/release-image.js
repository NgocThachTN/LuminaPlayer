const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

module.exports = async function handler(req, res) {
  try {
    const imageUrl = typeof req.query?.url === 'string' ? req.query.url : '';
    const parsedUrl = new URL(imageUrl);
    const isGitHubAttachment =
      parsedUrl.hostname === 'github.com' &&
      parsedUrl.pathname.startsWith('/user-attachments/assets/');

    if (!isGitHubAttachment) {
      res.statusCode = 400;
      res.end('Unsupported release image URL');
      return;
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      res.statusCode = response.status;
      res.end('Release image not found');
      return;
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) {
      res.statusCode = 415;
      res.end('Release asset is not an image');
      return;
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    res.end(imageBuffer);
  } catch (error) {
    res.statusCode = 500;
    res.end(error?.message || 'Release image proxy failed');
  }
};
