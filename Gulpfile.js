var _ = require('lodash');
var fs = require('fs');
var gulp = require('gulp');
var lr = require('tiny-lr');
var path = require('path');

var browserify = require('gulp-browserify');
var concat = require('gulp-concat');
var exec = require('gulp-exec');
var gutil = require('gulp-util');
var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');
var plumber = require('gulp-plumber');
var refresh = require('gulp-livereload');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var stylus = require('gulp-stylus');

var server = lr();
var config = _.extend({
  port: 8080,
  lrport: 35729,
  env: 'development'
}, gutil.env);

var path = {
  js: {
    bin: 'src/js/fs/usr/bin/*',
    lib: {
      all: 'src/js/**/*.js',
      entry: 'src/js/terminal.js'
    },
    fs: {
      all: 'src/js/fs/**/*.js',
      entry: 'src/js/file-system.json'
    },
    commands: {
      all: 'src/js/commands/**/*.js',
      entry: 'src/js/commands.js'
    },
    spec: {
      all: 'spec/js/**/*.js'
    }
  },
  css: {
    all: 'src/css/**/*.styl'
  },
  build: 'build/'
};

var production = config.env === 'production';

gulp.task('jshint', function () {
  return gulp.src(['Gulpfile.js', path.js.spec.all, path.js.lib.all])
    .pipe(plumber())
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('clean', function () {
  return gulp.src([path.build, path.js.bin])
    .pipe(plumber())
    .pipe(exec('rm -r <%= file.path %>'));
});

gulp.task('commands', ['clean'], function (cb) {
  var commands = fs.readdirSync('src/js/commands')
    .filter(function (f) {
      return f[0] != '.' && f.substr(-3) == '.js';
    }).map(function (f) {
      if (production) {
        exec('ln -fh ' + __dirname + '/src/js/commands/' + f + ' src/js/fs/usr/bin/' + f.slice(0, -3));
      }

      return 'require("' + './commands/' + f + '");';
    });

  fs.writeFileSync(path.js.commands.entry, commands.join('\n'));

  cb(null);
});

gulp.task('file-system', ['commands'], function (cb) {
  var _fs = {};
  var _ignore = [
    '\\.DS_Store',
    '.*\\.swp'
  ];
  var root = 'src/js/fs';

  (function readdir(path, container) {
    var files = fs.readdirSync(path);

    files.forEach(function (file) {
      for (var i = 0, l = _ignore.length; i < l; i++) {
        if (file.match(new RegExp('^' + _ignore[i] + '$'))) {
          return;
        }
      }

      var stat = fs.statSync(path + '/' + file);

      if (stat.isDirectory()) {
        var f = {};
        readdir(path + '/' + file, f);
        container[file] = f;
      } else {
        container[file] = fs.readFileSync(path + '/' + file).toString();
      }
    });
  })(root, _fs);

  fs.writeFileSync(path.js.fs.entry, JSON.stringify(_fs, null, 2));

  cb(null);
});

gulp.task('js', ['jshint', 'file-system'], function () {
  return gulp.src(path.js.lib.entry)
    .pipe(plumber())
    .pipe(browserify({ debug: !production }))//, standalone: true }))
    .pipe(gulp.dest(path.build))
    .pipe(rename({ suffix: '.min' }))
    .pipe(uglify())
    .pipe(gulp.dest(path.build))
    .pipe(refresh(server));
});

gulp.task('css', function () {
  return gulp.src(path.css.all)
    .pipe(plumber())
    .pipe(stylus({ set: (production ? ['compress'] : []), urlFunc: ['inline-image'] }))
    .pipe(concat('terminal.css'))
    .pipe(gulp.dest(path.build))
    .pipe(refresh(server));
});

gulp.task('build', ['js', 'css']);

gulp.task('watch', ['build'],function (cb) {
  server.listen(config.lrport, function (err) {
    if (err) {
      console.log(err);
    }
  });

  gulp.watch(path.css.all, ['css']);
  gulp.watch(path.js.lib.all, ['js']);

  cb(null);
});

gulp.task('spec', ['js'], function () {
  gulp
    .src('spec/**/*-spec.js')
    .pipe(mocha());
});

gulp.task('spec-live', ['spec'], function () {
  gulp.watch('src/js/**/*.js', ['js', 'spec']);
  gulp.watch('spec/**/*.js', ['spec']);
});

gulp.task('default', ['watch']);
