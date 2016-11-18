# Description

small wrapper & statsd tools around module statsd-client

# Api

```
const ans = require('afrostream-node-statsd');
ans.init({
  module: 'afrostream-back-end',
  watchdog: true,      // optional: (...).status.alive inc +1 every sec
  monitorMemory: true  // optional: memory status based on process.memoryUsage();
});
// metric for response time & success/error
//    will add keys :
//       (...).route.all.success (if 200ok)
//       (...).route.all.redirect (3XX)
//       (...).route.all.error (other)
app.use(ans.middleware());


app.get('/test',
  ans.middleware({route:'test'}),
  //    will add keys :
  //       (...).route.test.success (if 200ok)
  //       (...).route.test.redirect (3XX)
  //       (...).route.test.error (other)
  (req, res, next) => {
    // custom emitter :
    ans.client.increment('foo.bar');
  }
)
