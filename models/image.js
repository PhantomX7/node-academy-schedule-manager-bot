const mongoose = require('mongoose')

const imageSchema = new mongoose.Schema({
  name: String,
  imageId: {
    type: String,
    default: null
  },
  imageUrl: {
    type: String,
    default: null
  },
  imageThumbnailUrl: {
    type: String,
    default: null
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

const Image = mongoose.model('Image', imageSchema)

module.exports = Image
