
module.exports = function(grunt) {  // jshint ignore:line
	grunt.initConfig({
    uglify: {
      b2: {
        options: {
          sourceMap: true
        },
        files: {
          'b2-min.js': ['b2.js']
        }
      }
    }
  });

	grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.registerTask('default', ['uglify']);
};
