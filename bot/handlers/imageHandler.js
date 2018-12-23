const _ = require('lodash')
const moment = require('moment')
const cloudinary = require('cloudinary')
const db = require('../../models')
const template = require('../template')
const { withFlashes } = require('../flash')
const helper = require('../helper')


const PLACEHOLDER_IMAGE_URL = 'https://2.bp.blogspot.com/-V31y2Ef4Ad0/VZservQf70I/AAAAAAAAdu8/ErI--hbXwfE/s1600/OpenCamera1.png'

function paginize(images) {
  const makePaginationCard = (direction, page) => (
    {
      title: ' ',
      text: ' ',
      thumbnailImageUrl: PLACEHOLDER_IMAGE_URL,
      menuItems: [
        { type: 'postback', label: direction === 'previous' ? "<<<" : ">>>", data: `!image_view ${page}` },
        { type: 'postback', label: direction === 'previous' ? "Previous" : "Next", data: `!image_view ${page}` }
      ]
    }
  )
  const makeImageCard = (imageEntry) => (
    {
      title: `[${+imageEntry[0] + 1}] ${imageEntry[1].name}`,
      text: ' ',
      thumbnailImageUrl: imageEntry[1].imageThumbnailUrl,
      menuItems: [
        { type: 'postback', label: "View Detail", data: `!image_detail ${imageEntry[1]._id}` },
        { type: 'postback', label: "Delete", data: `!image_delete_confirm ${imageEntry[1]._id}` }
      ]
    }
  )

  const imageEntries = _.chain(images)
    .sortBy([
      image => image.name,
      image => moment(image.createdAt).valueOf()
    ])
    .entries()
    .value()

  if (imageEntries.length <= 9) {
    return [ imageEntries.map(imageEntry => makeImageCard(imageEntry)) ]
  } else {
    const front = [
      ..._.chain(imageEntries)
        .slice(0, 8)
        .map(imageEntry => makeImageCard(imageEntry))
        .value(),
      makePaginationCard('next', 1)
    ]
    const middle = _.chain(imageEntries)
      .slice(8, imageEntries.length - ((imageEntries.length - 8) % 7))
      .chunk(7)
      .map((chunk, index) => [
        makePaginationCard('previous', index),
        ..._.map(chunk, imageEntry => makeImageCard(imageEntry)),
        makePaginationCard('next', index + 2)
      ])
      .value()
    const back = [
      makePaginationCard('previous', middle.length),
      ..._.chain(imageEntries)
        .slice(imageEntries.length - ((imageEntries.length - 8) % 7))
        .map(imageEntry => makeImageCard(imageEntry))
        .value()
    ]
    return [ front, ...middle, back ]
  }
}

async function getViewImageMenu(evt, page) {
  const { userId, groupId, type } = evt.source
  const images = await db.Image.find({
    imageUrl: { $ne: null },
    imageId: { $ne: null },
    envType: type,
    ...( type === 'user' ? { createdBy: userId } : { groupId } )
  })
  
  const pages = paginize(images)

  page = page || 0
  if (page < 0 || page >= pages.length) return 'Page out of bound!'

  return template.makeCarousel(
    {
      title: 'All Images',
      columns: [
        {
          title: "All Images",
          text: images.length > 0 ? "Choose an action" : "No image yet",
          thumbnailImageUrl: PLACEHOLDER_IMAGE_URL,
          menuItems: [
            { type: 'postback', label: "Add", data: "!image_add_template" },
            { type: 'postback', label: "Back to Menu", data: "!woy" }
          ]
        },
        ...pages[page]
      ]
    }
  )
}

async function handler(bot, evt, command, arguments) {
  if (evt.type === 'postback' || evt.message.type === 'text') {
    if (command === '!image_view') {
      if (![0, 1].includes(_.size(arguments)))
        return await evt.reply(withFlashes('Arguments must be exactly 0 or 1!'))
      await evt.reply(withFlashes(await getViewImageMenu(evt, +(arguments[0] || 0))))
    } else if (command === '!image_detail') {
      try {
        if (_.size(arguments) !== 1)
          return await evt.reply(withFlashes('Arguments must be exactly 1!'))
        const image = await db.Image.findById(arguments[0])
        if (!image) 
          return await evt.reply(withFlashes('Image not found!'))

        const profile = await bot.getUserProfile(image.createdBy)
        await evt.reply(withFlashes(
          {
            type: 'image',
            originalContentUrl: image.imageUrl,
            previewImageUrl: image.imageUrl
          },
          helper.trimAround(`
            [Image Detail]
            Name: ${image.name}
            Created By: ${profile.displayName}
            Created At: ${moment(image.createdAt).format('DD MMMM YYYY')}
          `)
        ))
      } catch (err) {
        await evt.reply(withFlashes('Request failed. Please try again later.'))
      }



    } else if (command === '!image_add') {
      try {
        if (_.size(arguments) !== 1)
          return await evt.reply(withFlashes('Arguments must be exactly 1!'))
        
        const { userId, groupId, type } = evt.source
        await db.Image.create(
          {
            name: arguments[0],
            createdBy: userId,
            groupId: groupId || null,
            envType: type
          }
        )
        await evt.reply(withFlashes('Please upload your image immediately.'))
      } catch (err) {
        await evt.reply(withFlashes('Request failed. Please try again later.'))
      }
    } else if (command === '!image_add_template') {
      await evt.reply(withFlashes(
        `Please copy below input template and replace "image name" as you wish, then Send`,
        `!image_add "image name"`
      ))
    


    } else if (command === '!image_delete') {
      try {
        if (_.size(arguments) !== 1) 
          return await evt.reply(withFlashes('Arguments must be exactly 1!'))
        const image = await db.Image.findById(arguments[0])
        if (!image) 
          return await evt.reply(withFlashes('Image not found!'))

        await cloudinary.v2.uploader.destroy(image.imageId)
        await image.remove()
        await evt.reply(withFlashes(
          await getViewImageMenu(evt),
          'Image deleted successfully!'
        ))
      } catch (err) {
        await evt.reply(withFlashes('Request failed. Please try again later.'))
      }
    } else if (command === '!image_delete_confirm') {
      try {
        if (_.size(arguments) !== 1) 
          return await evt.reply(withFlashes('Arguments must be exactly 1!'))
        const image = await db.Image.findById(arguments[0])
        if (!image) 
          return await evt.reply(withFlashes('Image not found!'))

        await evt.reply(withFlashes(
          template.makeConfirm(
            {
              title: `Delete ${image.name}?`,
              type: 'postback',
              yesText: `!image_delete ${image._id}`,
              noText: `!image_view`
            }
          )
        ))
      } catch (err) {
        await evt.reply(withFlashes('Request failed. Please try again later.'))
      }



    } else {
      await evt.reply(withFlashes())
    }
  } else if (evt.message.type === 'image') {
    try {
      const { userId, groupId, type } = evt.source
      const image = await db.Image.findOne({
        imageId: null,
        imageUrl: null,
        imageThumbnailUrl: null,
        ...( type === 'user' ? { createdBy: userId } : { groupId } )
      })
      if (!image) return await evt.reply(withFlashes())

      const buffer = await evt.message.content()
      cloudinary.v2.uploader.upload_stream(
        async (error, result) => {
          if (error) return await evt.reply(withFlashes('Request failed. Please try again later.'))
          try {
            image.imageId = result.public_id
            image.imageUrl = result.secure_url
            const thumbnailImageUrl = await cloudinary.url(result.public_id, { aspect_ratio: "1:1", gravity: "face", crop: "fill" })
            image.imageThumbnailUrl = `https${thumbnailImageUrl.substring(4)}`
            await image.save()
            await evt.reply(withFlashes(
              await getViewImageMenu(evt),
              'Image uploaded!'
            ))
            console.log('done')
          } catch (error) {
            await evt.reply(withFlashes('Request failed. Please try again later.'))
          }
        }
      ).end(buffer)
    } catch (error) {
      return await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  }
}

module.exports = handler