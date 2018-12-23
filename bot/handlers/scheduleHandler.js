const _ = require('lodash')
const moment = require('moment')
const db = require('../../models')
const template = require('../template')
const { withFlashes } = require('../flash')
const helper = require('../helper')

function paginize(schedules) {
  const makePaginationCard = (direction, page) => (
    {
      title: ' ',
      text: ' ',
      menuItems: [
        { type: 'postback', label: direction === 'previous' ? "Previous" : "Next", data: `!schedule_view ${page}` }
      ]
    }
  )
  const makeScheduleCard = (scheduleEntry) => {
    const expiredStatus = moment().diff(moment(scheduleEntry[1].date)) > 24*60*60*1000 ? ' - Expired' : ''
    return {
      title: `[${+scheduleEntry[0] + 1}${expiredStatus}] ${scheduleEntry[1].name}`,
      text: moment(scheduleEntry[1].date).format('D MMMM YYYY'),
      menuItems: [
        { type: 'postback', label: "View Detail", data: `!schedule_detail ${scheduleEntry[1]._id}` }
      ]
    }
  }

  const scheduleEntries = _.chain(schedules)
    .sortBy([
      schedule => moment().diff(moment(schedule.date)) > 24*60*60*1000 ? 1 : 0,
      schedule => moment(schedule.date).valueOf()
    ])
    .entries()
    .value()

  if (scheduleEntries.length <= 9) {
    return [ scheduleEntries.map(scheduleEntry => makeScheduleCard(scheduleEntry)) ]
  } else {
    const front = [ 
      ..._.chain(scheduleEntries)
        .slice(0, 8)
        .map(scheduleEntry => makeScheduleCard(scheduleEntry))
        .value(),
      makePaginationCard('next', 1)
    ]
    const middle = _.chain(scheduleEntries)
      .slice(8, scheduleEntries.length - ((scheduleEntries.length - 8) % 7))
      .chunk(7)
      .map((chunk, index) => [
        makePaginationCard('previous', index),
        ..._.map(chunk, scheduleEntry => makeScheduleCard(scheduleEntry)),
        makePaginationCard('next', index + 2)
      ])
      .value()
    const back = [
      makePaginationCard('previous', middle.length),
      ..._.chain(scheduleEntries)
        .slice(scheduleEntries.length - ((scheduleEntries.length - 8) % 7))
        .map(scheduleEntry => makeScheduleCard(scheduleEntry))
        .value()
    ]
    return [ front, ...middle, back ]
  }
}

async function getViewScheduleMenu(evt, page) {
  const { userId, groupId, type } = evt.source
  const schedules = await db.Event.find(
    {
      envType: type,
      ...(type === 'user' ? { createdBy: userId } : { groupId })
    }
  )
  
  const pages = paginize(schedules)

  page = page || 0
  if (page < 0 || page >= pages.length) return 'Page out of bound!'

  return template.makeCarousel(
    {
      title: 'All Schedules',
      columns: [
        {
          title: "All Schedules",
          text: schedules.length > 0 ? "List of all events" : "No event yet",
          menuItems: [
            { type: 'postback', label: "Back to Menu", data: "!woy" }
          ]
        },
        ...pages[page]
      ]
    }
  )
}

async function handler(bot, evt, command, arguments) {

  if (command === '!schedule_view') {
    if (![0, 1].includes(_.size(arguments)))
      return await evt.reply(withFlashes('Arguments must be exactly 0 or 1!'))
    await evt.reply(withFlashes(await getViewScheduleMenu(evt, +(arguments[0] || 0))))
  } else if (command === '!schedule_detail') {
    try {
      if (_.size(arguments) !== 1)
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Schedule not found!'))

      const profile = await bot.getUserProfile(event.createdBy)
      await evt.reply(withFlashes(
        helper.trimAround(`
          [Schedule Detail]
          Name: ${event.name}
          Type: ${event.type}
          Date: ${moment(event.date).format('DD MMMM YYYY')}
          Created By: ${profile.displayName}
          Created At: ${moment(event.createdAt).format('DD MMMM YYYY')}
        `)
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  } else {
    await evt.reply(withFlashes())
  }

}

module.exports = handler