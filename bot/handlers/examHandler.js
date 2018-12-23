const _ = require('lodash')
const moment = require('moment')
const db = require('../../models')
const template = require('../template')
const { withFlashes } = require('../flash')
const helper = require('../helper')

function paginize(exams) {
  const makePaginationCard = (direction, page) => (
    {
      title: ' ',
      text: ' ',
      menuItems: [
        { type: 'postback', label: direction === 'previous' ? "<<<" : ">>>", data: `!exam_view ${page}` },
        { type: 'postback', label: direction === 'previous' ? "Previous" : "Next", data: `!exam_view ${page}` },
        { type: 'postback', label: direction === 'previous' ? "<<<" : ">>>", data: `!exam_view ${page}` }
      ]
    }
  )
  const makeExamCard = (examEntry) => {
    const expiredStatus = moment().diff(moment(examEntry[1].date)) > 24*60*60*1000 ? ' - Expired' : ''
    return {
      title: `[${+examEntry[0] + 1}${expiredStatus}] ${examEntry[1].name}`,
      text: moment(examEntry[1].date).format('D MMMM YYYY'),
      menuItems: [
        { type: 'postback', label: "View Detail", data: `!exam_detail ${examEntry[1]._id}` },
        { type: 'postback', label: "Edit", data: `!exam_edit_template ${examEntry[1]._id}` },
        { type: 'postback', label: "Delete", data: `!exam_delete_confirm ${examEntry[1]._id}` }
      ]
    }
  }

  const examEntries = _.chain(exams)
    .sortBy([
      exam => moment().diff(moment(exam.date)) > 24*60*60*1000 ? 1 : 0,
      exam => moment(exam.date).valueOf()
    ])
    .entries()
    .value()

  if (examEntries.length <= 9) {
    return [ examEntries.map(examEntry => makeExamCard(examEntry)) ]
  } else {
    const front = [ 
      ..._.chain(examEntries)
        .slice(0, 8)
        .map(examEntry => makeExamCard(examEntry))
        .value(),
      makePaginationCard('next', 1)
    ]
    const middle = _.chain(examEntries)
      .slice(8, examEntries.length - ((examEntries.length - 8) % 7))
      .chunk(7)
      .map((chunk, index) => [
        makePaginationCard('previous', index),
        ..._.map(chunk, examEntry => makeExamCard(examEntry)),
        makePaginationCard('next', index + 2)
      ])
      .value()
    const back = [
      makePaginationCard('previous', middle.length),
      ..._.chain(examEntries)
        .slice(examEntries.length - ((examEntries.length - 8) % 7))
        .map(examEntry => makeExamCard(examEntry))
        .value()
    ]
    return [ front, ...middle, back ]
  }
}

async function getViewExamMenu(evt, page) {
  const { userId, groupId, type } = evt.source
  const exams = await db.Event.find(_.assign(
    {
      type: 'exam',
      envType: type
    },
    ( type === 'user' ? { createdBy: userId } : { groupId } )
  ))
  
  const pages = paginize(exams)

  page = page || 0
  if (page < 0 || page >= pages.length) return 'Page out of bound!'

  return template.makeCarousel(
    {
      title: 'All Exams',
      columns: [
        {
          title: "All Exams", 
          text: exams.length > 0 ? "Choose an action" : "No exam yet",
          menuItems: [
            { type: 'postback', label: " ", data: " " },
            { type: 'postback', label: "Add", data: "!exam_add_template" },
            { type: 'postback', label: "Back to Menu", data: "!woy" }
          ]
        },
        ...pages[page]
      ]
    }
  )
}

async function handler(bot, evt, command, arguments) {

  if (command === '!exam_view') {
    if (![0, 1].includes(_.size(arguments)))
        return await evt.reply(withFlashes('Arguments must be exactly 0 or 1!'))
    await evt.reply(withFlashes(await getViewExamMenu(evt, +(arguments[0] || 0))))
  } else if (command === '!exam_detail') {
    try {
      if (_.size(arguments) !== 1)
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Exam not found!'))

      const profile = await bot.getUserProfile(event.createdBy)
      await evt.reply(withFlashes(
        helper.trimAround(`
          [Exam Detail]
          Name: ${event.name}
          Date: ${moment(event.date).format('DD MMMM YYYY')}
          Created By: ${profile.displayName}
          Created At: ${moment(event.createdAt).format('DD MMMM YYYY')}
        `)
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }



  } else if (command === '!exam_add') {
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
          type: 'exam'
        }
      )
      await evt.reply(withFlashes(
        await getViewExamMenu(evt),
        'Exam created succesfully!'
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  } else if (command === '!exam_add_template') {
    await evt.reply(withFlashes(
      `Please copy below input template and replace "exam name" and "date" as you wish, then Send`,
      `!exam_add "exam name" ${moment().format('DD-MM-YYYY')}`
    ))
  


  } else if (command === '!exam_delete') {
    try {
      if (_.size(arguments) !== 1) 
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Exam not found!'))

      await event.remove()
      await evt.reply(withFlashes(
        await getViewExamMenu(evt),
        'Exam deleted successfully!'
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  } else if (command === '!exam_delete_confirm') {
    try {
      if (_.size(arguments) !== 1) 
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Exam not found!'))

      await evt.reply(withFlashes(
        template.makeConfirm(
          {
            title: `Delete ${event.name} [${moment().format('DD-MM-YYYY')}] ?`,
            type: 'postback',
            yesText: `!exam_delete ${event._id}`,
            noText: `!exam_view`
          }
        )
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }



  } else if (command === '!exam_edit') {
    try {
      if (_.size(arguments) !== 3) 
        return await evt.reply(withFlashes('Arguments must be exactly 3!'))
      if (!moment(arguments[2], 'DD-MM-YYYY', true).isValid()) 
        return await evt.reply(withFlashes('Invalid date!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Exam not found!'))

      event.name = arguments[1]
      event.date = moment(arguments[2], 'DD-MM-YYYY').toDate()
      await event.save()
      await evt.reply(withFlashes(
        await getViewExamMenu(evt),
        `Exam edited successfully!`
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  } else if (command === '!exam_edit_template') {
    try {
      if (_.size(arguments) !== 1) 
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Exam not found!'))

      await evt.reply(withFlashes(
        `Please copy below edit template and replace "exam name" and "date" as you wish, then Send`,
        `!exam_edit ${event._id} "${event.name}" ${moment(event.date).format('DD-MM-YYYY')}`
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }



  } else {
    await evt.reply(withFlashes())
  }
}

module.exports = handler