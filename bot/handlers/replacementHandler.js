const _ = require('lodash')
const moment = require('moment')
const db = require('../../models')
const template = require('../template')
const { withFlashes } = require('../flash')
const helper = require('../helper')

function paginize(replacements) {
  const makePaginationCard = (direction, page) => (
    {
      title: ' ',
      text: ' ',
      menuItems: [
        { type: 'postback', label: direction === 'previous' ? "<<<" : ">>>", data: `!replacement_view ${page}` },
        { type: 'postback', label: direction === 'previous' ? "Previous" : "Next", data: `!replacement_view ${page}` },
        { type: 'postback', label: direction === 'previous' ? "<<<" : ">>>", data: `!replacement_view ${page}` }
      ]
    }
  )
  const makeReplacementCard = (replacementEntry) => {
    const expiredStatus = moment().diff(moment(replacementEntry[1].date)) > 24*60*60*1000 ? ' - Expired' : ''
    return {
      title: `[${+replacementEntry[0] + 1}${expiredStatus}] ${replacementEntry[1].name}`,
      text: moment(replacementEntry[1].date).format('D MMMM YYYY'),
      menuItems: [
        { type: 'postback', label: "View Detail", data: `!replacement_detail ${replacementEntry[1]._id}` },
        { type: 'postback', label: "Edit", data: `!replacement_edit_template ${replacementEntry[1]._id}` },
        { type: 'postback', label: "Delete", data: `!replacement_delete_confirm ${replacementEntry[1]._id}` }
      ]
    }
  }

  const replacementEntries = _.chain(replacements)
    .sortBy([
      replacement => moment().diff(moment(replacement.date)) > 24*60*60*1000 ? 1 : 0,
      replacement => moment(replacement.date).valueOf()
    ])
    .entries()
    .value()

  if (replacementEntries.length <= 9) {
    return [ replacementEntries.map(replacementEntry => makeReplacementCard(replacementEntry)) ]
  } else {
    const front = [ 
      ..._.chain(replacementEntries)
        .slice(0, 8)
        .map(replacementEntry => makeReplacementCard(replacementEntry))
        .value(),
      makePaginationCard('next', 1)
    ]
    const middle = _.chain(replacementEntries)
      .slice(8, replacementEntries.length - ((replacementEntries.length - 8) % 7))
      .chunk(7)
      .map((chunk, index) => [
        makePaginationCard('previous', index),
        ..._.map(chunk, replacementEntry => makeReplacementCard(replacementEntry)),
        makePaginationCard('next', index + 2)
      ])
      .value()
    const back = [
      makePaginationCard('previous', middle.length),
      ..._.chain(replacementEntries)
        .slice(replacementEntries.length - ((replacementEntries.length - 8) % 7))
        .map(replacementEntry => makeReplacementCard(replacementEntry))
        .value()
    ]
    return [ front, ...middle, back ]
  }
}

async function getViewReplacementMenu(evt, page) {
  const { userId, groupId, type } = evt.source
  const replacements = await db.Event.find(_.assign(
    { 
      type: 'replacement',
      envType: type 
    },
    ( type === 'user' ? { createdBy: userId } : { groupId } )
  ))
  
  const pages = paginize(replacements)

  page = page || 0
  if (page < 0 || page >= pages.length) return 'Page out of bound!'

  return template.makeCarousel(
    {
      title: 'All Replacements',
      columns: [
        {
          title: "All Replacements",
          text: replacements.length > 0 ? "Choose an action" : "No replacements yet",
          menuItems: [
            { type: 'postback', label: " ", data: " " },
            { type: 'postback', label: "Add", data: "!replacement_add_template" },
            { type: 'postback', label: "Back to Menu", data: "!woy" }
          ]
        },
        ...pages[page]
      ]
    }
  )
}

async function handler(bot, evt, command, arguments) {

  if (command === '!replacement_view') {
    if (![0, 1].includes(_.size(arguments)))
        return await evt.reply(withFlashes('Arguments must be exactly 0 or 1!'))
    await evt.reply(withFlashes(await getViewReplacementMenu(evt, +(arguments[0] || 0))))
  } else if (command === '!replacement_detail') {
    try {
      if (_.size(arguments) !== 1)
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Replacement not found!'))

      const profile = await bot.getUserProfile(event.createdBy)
      await evt.reply(withFlashes(
        helper.trimAround(`
          [Replacement Detail]
          Name: ${event.name}
          Date: ${moment(event.date).format('DD MMMM YYYY')}
          Created By: ${profile.displayName}
          Created At: ${moment(event.createdAt).format('DD MMMM YYYY')}
        `)
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }



  } else if (command === '!replacement_add') {
    try {
      if (_.size(arguments) !== 2)
        return await evt.reply(withFlashes('Arguments must be exactly 2!'))
      if (!moment(arguments[1], 'DD-MM-YYYY', true).isValid()) 
        return await evt.reply(withFlashes('Invalid date!'))

      const { userId, groupId, type } = evt.source
      await db.Event.create(
        {
          name: arguments[0],
          date: moment(arguments[1], 'DD-MM-YYYY').toDate(),
          createdBy: userId,
          groupId: groupId || null,
          envType: type,
          type: 'replacement'
        }
      )
      await evt.reply(withFlashes(
        await getViewReplacementMenu(evt),
        'Replacement created succesfully!'
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  } else if (command === '!replacement_add_template') {
    await evt.reply(withFlashes(
      `Please copy below input template and replace "replacement name" and "date" as you wish, then Send`,
      `!replacement_add "replacement name" ${moment().format('DD-MM-YYYY')}`
    ))
  


  } else if (command === '!replacement_delete') {
    try {
      if (_.size(arguments) !== 1) 
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Replacement not found!'))

      await event.remove()
      await evt.reply(withFlashes(
        await getViewReplacementMenu(evt),
        'Replacement deleted successfully!'
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  } else if (command === '!replacement_delete_confirm') {
    try {
      if (_.size(arguments) !== 1) 
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Replacement not found!'))

      await evt.reply(withFlashes(
        template.makeConfirm(
          {
            title: `Delete ${event.name} [${moment().format('DD-MM-YYYY')}] ?`,
            type: 'postback',
            yesText: `!replacement_delete ${event._id}`,
            noText: `!replacement_view`
          }
        )
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }



  } else if (command === '!replacement_edit') {
    try {
      if (_.size(arguments) !== 3) 
        return await evt.reply(withFlashes('Arguments must be exactly 3!'))
      if (!moment(arguments[2], 'DD-MM-YYYY', true).isValid()) 
        return await evt.reply(withFlashes('Invalid date!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Replacement not found!'))

      event.name = arguments[1]
      event.date = moment(arguments[2], 'DD-MM-YYYY').toDate()
      await event.save()
      await evt.reply(withFlashes(
        await getViewReplacementMenu(evt),
        `Replacement edited successfully!`
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  } else if (command === '!replacement_edit_template') {
    try {
      if (_.size(arguments) !== 1) 
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Replacement not found!'))

      await evt.reply(withFlashes(
        `Please copy below edit template and replace "replacement name" and "date" as you wish, then Send`,
        `!replacement_edit ${event._id} "${event.name}" ${moment(event.date).format('DD-MM-YYYY')}`
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }



  } else {
    await evt.reply(withFlashes())
  }
}

module.exports = handler