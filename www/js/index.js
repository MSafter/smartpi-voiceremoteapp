//audio input
var audioBuffer = [];
var totalReceivedData = 0;
var config = {};

//detection
var NOTALKEDINTERVAL = 500; //Interval how long the detecion should wait bevor send the command 
var startedTime; // time in millis when user speaking is detected
var currentTime; // current time in millis
var commandSet = false; // is comamnd set 
var nextCommandLastUpdated; // time in millis where the last command was send 
var nextCommandDelay = 3000; // Delay how long command aren't allowed
var detectionLevel = 7 // detection level of the voice

var app = {
    // Application Constructor
    initialize: function () {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function () {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        window.addEventListener("audioinput", this.onAudioInput, false);
    },
    onAudioInput: function (evt) {
        if (evt && evt.data) {
            currentTime = Date.now();

            if (commandSet) {
                if ((currentTime - nextCommandLastUpdated) < nextCommandDelay) {
                    updateStatus('Lock', 'no userinput allowed due to delay', ['voice']);
                    return;
                }
                updateStatus('Service ready', 'listening for user input', ['voice']);
            }

            if ((Math.round(Math.max.apply(null, evt.data) * 1000000000000000000) / 10000000000000000) > detectionLevel) {
                updateStatus('Input', 'user is speaking...', ['voice']);
                totalReceivedData += evt.data.length;
                audioBuffer = audioBuffer.concat(evt.data);
                startedTime = Date.now();
                commandSet = false;
            } else {
                if ((currentTime - startedTime) > NOTALKEDINTERVAL && !commandSet) {
                    updateStatus('Command', 'preparing userinput for backend call', ['voice', 'backend']);
                    sendToBackend();
                    commandSet = true;
                    nextCommandLastUpdated = Date.now();
                }
            }
        }
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function () {
        // Android customization
        cordova.plugins.backgroundMode.setDefaults({ text: 'Smartpi service is running...' });
        // Enable background mode
        cordova.plugins.backgroundMode.enable();

        statusElement = document.getElementById('status');
        app.receivedEvent('deviceready');
        config = {
            sampleRate: 16000,
            bufferSize: 2048,
            channels: audioinput.CHANNELS.MONO,
            format: audioinput.FORMAT.PCM_16BIT,
            normalize: true,
            normalizationFactor: 32767.0,
            streamToWebAudio: false,
            concatenateMaxChunks: 10,
            audioSourceType: audioinput.AUDIOSOURCE_TYPE.MIC
        };
    },
    // Update DOM on a Received Event
    receivedEvent: function (id) {
        console.log('Received Event: ' + id);
    }
};

function startService() {
    updateStatus('Service ready', 'listening for user input', []);
    audioinput.start(config);
}

function stop() {
    audioinput.stop();
}

function updateStatus(title, summary, type) {
    var mainStatus = $('#mainStatus');
    var subStatus = $('#subStatus');

    $('.iconStatus').each(function (item) {
        $(item).removeClass('active');
    });

    if (type.indexOf('backend') !== -1) {
        $('#statusBackend').addClass('active');
    }

    if (type.indexOf('voice') !== -1) {
        $('#statusRecord').addClass('active');
    }

    mainStatus.html(title);
    subStatus.html(summary);
}

function sendToBackend() {

    //build the blob
    var encoder = new WavAudioEncoder(config.sampleRate, config.channels);
    encoder.encode([audioBuffer]);
    var blob = encoder.finish("audio/wav");

    //prepare formdata for request
    var fd = new FormData();
    fd.append('userCommand', blob);
    updateStatus('Backend', 'sending command to the backend', ['backend']);
    //do the request
    $.ajax({
        type: 'POST',
        url: 'http://<you-pi-ip-here>:8080/api/upload',
        data: fd,
        processData: false,
        contentType: false,
        success: function (data) {
            updateStatus('Backend', 'Command successfully send to backend', ['voice', 'backend']);
        },
        error: function (error) {
            updateStatus('Backend', 'Error sending command to backend', ['voice', 'backend']);
        }
    });

    //reset the audioBuffer for the next command
    audioBuffer = [];
}

app.initialize();