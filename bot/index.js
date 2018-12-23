const _ = require('lodash')
const template = require('./template')
const { addFlash, withFlashes } = require('./flash')
const scheduleHandler = require('./handlers/scheduleHandler')
const examHandler = require('./handlers/examHandler')
const replacementHandler = require('./handlers/replacementHandler')
const imageHandler = require('./handlers/imageHandler')
const helper = require('./helper')

const linebot = require('linebot')
const bot = linebot({
  channelId: process.env.CHANNEL_ID,
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  verify: true,
})

async function cancelImageUploads(evt) {
  const db = require('../models')
  try {
    const { userId, groupId, type } = evt.source
    const images = await db.Image.find({
      imageId: null,
      imageUrl: null,
      imageThumbnailUrl: null,
      envType: type,
      ...( type === 'user' ? { createdBy: userId } : { groupId } )
    })
    for (const image of images) await image.remove()
    if (images.length) addFlash('Cancelled image upload(s)')
  } catch (error) {
    console.log(error)
  }
}

async function webhookHandler(evt) {
  const QUERY_KEY = {
    'message': 'message.text',
    'postback': 'postback.data',
  }
  if (evt.type === 'postback' || evt.message.type === 'text') {
    // reset image upload
    await cancelImageUploads(evt)

    const text = _.get(evt, QUERY_KEY[evt.type]).trim().toLowerCase()
    const tokens = helper.parseTokens(text)
    const command = _.head(tokens)
    const arguments = _.tail(tokens)
    if (!command.startsWith('!')) return await evt.reply({})
    
    if (command === '!woy') {
      // new carousel menu
      await evt.reply(withFlashes(
        template.makeCarousel(
          {
            title: 'Main Menu',
            columns: [
              {
                title: "Academic Schedule Manager Bot [Menu 1]", 
                text: "Choose an action",
                menuItems: [
                  { type: 'postback', label: "View All Schedule", data: "!schedule_view" },
                  { type: 'postback', label: "Help", data: "!help" },
                  { type: 'postback', label: "About", data: "!about" }
                ]
              },
              {
                title: "Academic Schedule Manager Bot [Menu 2]",
                text: "Choose an action",
                menuItems: [
                  { type: 'postback', label: "View Exams", data: "!exam_view" },
                  { type: 'postback', label: "View Replacements", data: "!replacement_view" },
                  { type: 'postback', label: "View Images", data: "!image_view" }
                ]
              }
            ]
          }
        )
      ))
      // old single menu
      // await evt.reply(withFlashes(
      //   template.makeMenu(
      //     {
      //       title: "Academic Schedule Manager Bot", 
      //       text: "Choose an action",
      //       menuItems: [
      //         { type: 'postback', label: "View All Schedule", data: "!schedule_view" },
      //         { type: 'postback', label: "Manage Exams", data: "!exam_view" },
      //         { type: 'postback', label: "Manage Replacements", data: "!replacement_view" },
      //         // { type: 'postback', label: "Manage Images", data: "!image_view" },
      //         { type: 'postback', label: "About", data: "!about" }
      //       ]
      //     }
      //   )
      // ))
    } else if (command.startsWith('!schedule')) {
      await scheduleHandler(bot, evt, command, arguments)
    } else if (command.startsWith('!exam')) {
      await examHandler(bot, evt, command, arguments)
    } else if (command.startsWith('!replacement')) {
      await replacementHandler(bot, evt, command, arguments)
    } else if (command.startsWith('!image')) {
      await imageHandler(bot, evt, command, arguments)
    } else if (command === '!help') {
      await evt.reply(withFlashes(
        helper.trimAround(
          `
            List of common commands:
            * !help   -> to list out common commands)
            * !about  -> to show information about htis bot
          `
        )
      ))
    } else if (command === '!about') {
      await evt.reply(withFlashes(
        helper.trimAround(
          `
            Saya adalah sebuah chatbot yang bisa membantu anda untuk menyimpan reminder ujian maupun kelas replacement.
            Semoga saya dapat memberikan kemudahan kepada saudara-saudara sekalian.

            Regards,
            ID.
          `
        )
      ))
    } else {
      await evt.reply(withFlashes())
    }
  } else if (evt.message.type === 'image') {
    await imageHandler(bot, evt)
  } else {
    await evt.reply(withFlashes())
  }
}

bot.on('message', async (evt) => {
  await webhookHandler(evt)
})

bot.on('postback', async function (evt) {
  await webhookHandler(evt)
})

bot.on('follow', function (evt) {
  evt.reply(withFlashes(
    helper.trimAround(
      `
        Terima kasih sudah follow saya. 

        Saya bisa dipakai secara pribadi maupun group. 
        Untuk pemakaian dalam group silahkan add saya langsung ke dalam group tersebut.

        Untuk menampilkan menu utama, ketik "!woy" tanpa tanda kutip.

        Regards,
        ID.
      `
    )
  ))
})

bot.on('join', function (evt) {
  evt.reply(withFlashes(
    helper.trimAround(
      `
        Terima kasih sudah meng-invite saya. 

        Untuk menampilkan menu utama, ketik "!woy" tanpa tanda kutip.

        Regards,
        ID.
      `
    )
  ))
})

module.exports = bot
