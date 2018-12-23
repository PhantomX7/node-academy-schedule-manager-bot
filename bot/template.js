const _ = require('lodash')

function makeMenu(options) {
  const { title, text, menuItems } = options
  return {
    type: "template",
    altText: title,
    template: {
      type: "buttons",
      title: title,
      text: text,
      actions: _.map(menuItems, menuItem => (
        { 
          type: menuItem.type || "message",
          ...menuItem
        }
      ))
    }
  }
}

function makeCarousel(options) {
  const { title, columns } = options
  return {
    "type": "template",
    "altText": title,
    "template": {
      "type": "carousel",
      "actions": [],
      "columns": _.map(columns, col => (
        {
          "title": col.title,
          "text": col.text,
          ...(col.thumbnailImageUrl ? { thumbnailImageUrl: col.thumbnailImageUrl } : {}),
          "actions": _.map(col.menuItems, menuItem => (
            { 
              type: menuItem.type || "message",
              ...menuItem
            }
          ))
        }
      ))
    }
  }
}

function makeConfirm(options) {
  const DICT = {
    'message': 'text',
    'postback': 'data'
  }
  const { title, type, yesText, noText } = options
  return {
    "type": "template",
    "altText": title,
    "template": {
      "type": "confirm",
      "text": title,
      "actions": [
        {
          "type": type || "message",
          "label": "Yes",
          [DICT[type]]: yesText || "Yes"
        },
        {
          "type": type || "message",
          "label": "No",
          [DICT[type]]: noText || "No"
        }
      ]
    }
  }
}


module.exports = {
  makeMenu,
  makeCarousel,
  makeConfirm,
}
