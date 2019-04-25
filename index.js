const needle = require('needle')

const package = require('./package')

const manifest = {
    id: 'org.allsprk.tv',
    version: package.version,
    logo: 'https://stream.allsprk.tv/favicon.png',
    name: 'IPTV from Allsprk.tv',
    description: '10 Custom IPTV Channels',
    resources: ['catalog', 'meta', 'stream'],
    types: ['tv'],
    idPrefixes: ['allsprk:'],
    catalogs: [
      {
        type: 'tv',
        id: 'allsprktvchannels',
        name: 'Allsprk.tv',
        extra: [
          {
            name: 'search'
          }
        ]
      }
    ]
}

// using images from online and yt thumbs as placeholders
const thumbnails = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSkm0WGI-Y3NfUmSg4TOhZYxA5_78OcOMN6qjTnHSvvi7_LuvSR',
  'Huggdy7ohb4',
  'rkd-Vs_gTyc',
  'sppcp-alo_Y',
  'C0s9Y81rdBQ',
  'KOj5CV_jXlI',
  'R8QIrKCJVAk',
  'WsTxqd6cj3w',
  'Cy7nR6hcpkI',
  '97u-EaPrVMU'
]

const chanTypes = [
  'Fantasy Series',
  'Premium Movies',
  'Sci-Fi Series',
  'Documentaries',
  'Anime',
  'Cartoons',
  'Sci-Fi Series',
  'Crime Series',
  'Drama Series',
  'Documentaries'
]

const channels = thumbnails.map((thumbnail, i) => {
  const thumb = thumbnail.startsWith('http') ? thumbnail : 'https://img.youtube.com/vi/' + thumbnail + '/0.jpg'
  return {
    id: 'allsprk:chan-' + i,
    name: 'Channel #' + i + ' - ' + chanTypes[i],
    type: 'tv',
    logo: thumb,
    poster: thumb,
    posterShape: 'landscape',
    streams: [
      {
        // all the stream links are static
        url: 'https://stream.allsprk.tv/live/' + i + '/index.m3u8'
      }
    ]
  }
})

const { addonBuilder, serveHTTP, publishToCentral }  = require('stremio-addon-sdk')

const addon = new addonBuilder(manifest)

const paginate = 40

addon.defineCatalogHandler(args => {
  return new Promise((resolve, reject) => {
    if (args.extra.search) {

      const queries = args.extra.search.toLowerCase().split('#').join('').split(' ')
      const results = []

      for (let i = 0; i < 10; i++) {
        const chanName = 'channel '+i
        const notFound = queries.some(el => {
          if (!chanName.includes(el)) return true
        })
        if (!notFound)
          results.push(channels[i])
      }

      if (results.length)
        resolve({ metas: results })
      else
        reject(new Error('No search results'))

    } else {
      const skip = parseInt(args.extra.skip || 0)
      resolve({ metas: channels })
    }
  })
})

function getEpg(obj) {
  return new Promise((resolve, reject) => {
    if (obj.streams[0].title) {
      resolve(obj)
    } else {
      const opts = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36',
          'Origin': 'https://stream.allsprk.tv',
          'Referer': obj.streams[0].url
        }
      }
      needle.get('https://stream.allsprk.tv/title.' + obj.id.replace('allsprk:chan-', '') + '.txt', opts, (err, resp, body) => {
        if (err)
            reject(err)
        else {
          obj.streams[0].title = body && body.length ? body.replace(/(\r\n|\n|\r)/gm, "") : ''
          // get every 10 minutes
          setTimeout(() => {
            delete obj.streams[0].title
          }, 600000)
          resolve(obj)
        }
      })
    }
  })
}

addon.defineMetaHandler(args => {
  return new Promise((resolve, reject) => {
    channels.some((el, ij) => {
      if (el.id == args.id) {
        resolve({ meta: el })
        return true
      }
    })
  })
})

addon.defineStreamHandler(args => {
  return new Promise((resolve, reject) => {
    channels.some((el, ij) => {
      if (args.id.startsWith(el.id)) {
        getEpg(el).then(result => {
          channels[ij] = result
          resolve({ streams: result.streams })
        }).catch(err => {
          console.error(err)
          resolve({
            streams: [
              {
                title: 'Channel #' + ij,
                url: el.streams[0].url
              }
            ],
            cacheMaxAge: 600
          })
        })
        return true
      }
    })
  })
  return new Promise((resolve, reject) => {
    resolve({ streams: [ { url: metas.toVideoUrl(args.id) } ] })
  })
})

module.exports = addon.getInterface()
