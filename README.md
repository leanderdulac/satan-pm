# satan-pm
[![Build Status](https://travis-ci.org/pagarme/satan-pm.svg)](https://travis-ci.org/pagarme/satan-pm) [![Coverage Status](https://coveralls.io/repos/pagarme/satan-pm/badge.svg?branch=master)](https://coveralls.io/r/pagarme/satan-pm?branch=master)

Upstart friendly node.js cluster manager.

# Usage

```
  Usage: satan [options] -- [args...]

  Options:

    -h, --help                      output usage information
    -V, --version                   output the version number
    -s, --script [path]             worker script path
    -d, --working-directory [path]  working directory
    -i, --instances [count]         number of workers to spawn
    -n, --node-arguments [args]     custom arguments to nodejs
    -p, --scheduling-policy         cluster scheduling policy(none or rr)
    -c, --config [path]             config file path
    -p, --pid-file [path]           pid file path
```

# Graceful Reload

When satan-pm process receives a `SIGHUP` signal, it will gracefully reload all workers, each at a time.

To do so, it will trigger a disconnect on the worker with `cluster.worker.disconnect()`.

You can hook up the shutdown process to do a custom cleanup procedure(e.g.: you have a worker consuming a Redis queue). For this you need to add a listener to the `shutdown` event on the global variable `process`.

Please note that when you listen to the `shutdown` event, you are responsible for terminating the process(i.e.: call `cluster.worker.disconnect()`).

# Graceful Shutdown

`satan-pm` will also do a graceful shutdown when it receives a `SIGTERM` or `SIGINT` signal. The behaviour is exactly the same as the graceful reload.

# Example

## config.json
```
{
	"workingDirectory": "/app/your-server/current",
	"script": "bin/server.js",
	"arguments": "-p 3000",
	"instances": 4
}
```

Running:

```sh
satan -c config.json
```

# Bonus: GC Signal

When `satan-pm` receives a `SIGUSR2` it will trigger a garbage collection. This is useful when debugging memory leaks or when you need to clean up the memory before a reload.

# Bonus: Upstart Configuration

This is a example upstart configuration that plays well with satan:

```upstart
start on started networking
stop on stopping networking

respawn
respawn limit 5 20

reload signal SIGHUP

chdir /app/your-server/current

setuid deploy
setgid deploy

env NODE_ENV=production

exec /usr/bin/satan -c /app/your-server/shared/satan.json

```

# License

Check [here](LICENSE).

