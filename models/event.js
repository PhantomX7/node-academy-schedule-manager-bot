const mongoose = require('mongoose')

const eventSchema = new mongoose.Schema({
  name: String,
  date: Date,
  type: {
    type: String,
    enum: ['exam', 'replacement']
  },
  createdBy: String,
  groupId: String,
  envType: {
    type: String,
    enum: ['user', 'group']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

const Event = mongoose.model('Event', eventSchema)

module.exports = Event
