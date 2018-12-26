const localtunnel = require('localtunnel');
localtunnel(3000, { subdomain: 'phantomdevtesting' }, function(err, tunnel) {
  console.log(err);
  console.log('LT running');
});
