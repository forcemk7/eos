// Custom Next.js server to increase header size limit
// This fixes the "431 Request Header Fields Too Large" error
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Increase maxHeaderSize to 32KB (default is 8KB)
  // This allows larger cookies and headers
  createServer(
    {
      maxHeaderSize: 32768, // 32KB
    },
    (req, res) => {
      try {
        const parsedUrl = parse(req.url, true)
        handle(req, res, parsedUrl)
      } catch (err) {
        console.error('Error occurred handling', req.url, err)
        res.statusCode = 500
        res.end('internal server error')
      }
    }
  )
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log(`> Header size limit increased to 32KB`)
    })
})
