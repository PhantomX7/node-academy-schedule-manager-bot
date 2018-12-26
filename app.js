require('dotenv').config()
require('./services/cloudinary')

const express = require('express')
const app = express()

app.use(express.static('res'))
app.use((req, res, next) => {
  next()
})

app.get('/webhook', (req, res) => {
  res.json({ text: 'GET response from /linewebhook' })
})
app.post('/webhook', require('./bot').parser())
app.all('*', (req, res) => res.send('ALL *'))

const PORT = process.env.PORT || 3000
app.listen(PORT, function () {
  console.log(`Line Bot is running on port ${PORT}.`)
})
