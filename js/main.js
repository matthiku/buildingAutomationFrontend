/* 
 * main JS for new index.php
 * 
 * (C) 2014,2015 Matthias Kuhs
 * Ennis, Ireland
 * 
 * 
 * TODO: 
 * - use fixed colors for the graph
 */

if (document.URL.search('localhost')>0){
    // on WAMP
    var baseURL = "/dev/buildingAPI/public/";   
}
else {
    // in production 
    var baseURL = "/buildingAPI/public/";
}

var oauth = {
    cmd: 'oauth/access_token',
    tokenRequest: {
        'grant_type'    : 'client_credentials',
        'client_id'     : 'reader',
        'client_secret' : "vz0Rf7",
    },
    accToken: '',
    expire: 0,
};


// get weekday name of date object: weekdayName[dateObj.getDay()] 
weekdayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    
// default time range values for data to be shown on the graph
var hours = 2, days = 0;  

// stop refreshing when config popup is active
var refreshing = true;

// chart components as globals
var chart, myView, options, chartData;
var prwChart, pwrView, pwrOptions, pwrChartData;

// events
var events;
var todaysEvent;

// heating status
var boiler_on=0, heating_on=0;

// check whether we are on a mobile device 
var isMobile = window.matchMedia("only screen and (max-width: 760px)");

var heatingControl;

var docTitle = document.title;


// Load the Google Visualization API and the piechart package.
google.load('visualization', '1.0', {'packages':['corechart']});

// Set a callback to run when the Google Visualization API is loaded.
google.setOnLoadCallback(drawChart);

// function called by the google viz tool
// creates and populates a google viz data table, 
// instantiates the line chart, passes in the data and draws it.
function drawChart() {

    // Create the data table, add the columns
    chartData = new google.visualization.DataTable();
    chartData.addColumn('string', 'Time or Date', 'timedate' );
    chartData.addColumn('number', 'Main  Room',   'mainroom' );
    chartData.addColumn('number', 'Heat Temp',    'heatemp'  );
    chartData.addColumn('number', 'Front Room',   'frontroom');
    chartData.addColumn('number', 'Heat on?',     'heating'  );
    chartData.addColumn('number', 'Power kW',     'power'    );
    chartData.addColumn('number', 'Outdoor Temp', 'outdoor'  );
    chartData.addColumn('number', 'Baby Room',    'babyroom' );
    chartData.addColumn('string', 'Timestamp',    'updated_at');

    // Set chart options as an array
    options = {
               height: 250, 
            chartArea: {width: '100%'},
               legend: {position: 'top'},
            curveType: 'function',
                title: 'Data from last 1 hour',
             explorer: {},
   axisTitlesPosition: 'in',
                vAxis: {textPosition: 'in', 
                        gridLines: {color: '#333', count: 4} }
    };

    // Instantiate and draw general chart, passing in some options.
    chart = new google.visualization.LineChart( document.getElementById('drawChart') );

    // default values var data range
    var howmuch = hours;
    var unit = 'hour';
    if (1*hours===0) {
        unit = 'day';
        howmuch = days; 
    }
    
    // request the data from the server-side DB
    // initially, we just want data from the last hour
    $.getJSON(
        baseURL+'templog',{
            howmuch : howmuch,
            unit    : unit
        }, 
        function(data,status){
            if (status==='success') {
                $('#hours').val(hours);
                $('#days').val(days);
                data = data["data"];
                if (data.length<1) { 
                    // write placeholder text instead
                    $('#drawChart').html('<span id="noDataFound">No data found for selected date range</span>');
                    $('#noDataFound').css('background','orange');
                    hours++;
                    chartLoaded('empty');
                    return; }


                // show last record in title bar (div "liveData")
                fillTitleBar(data[data.length-1]);

                // turn the JSON into an array of value arrays
                tempData =[];
                for (var i = 0; i < data.length; i++) {
                    tempData.push( [
                            data[i]['updated_at'].substr(11,5), 
                            data[i]['mainroom'], 
                            data[i]['auxtemp'], 
                            data[i]['frontroom'], 
                            data[i]['heating_on'], 
                            data[i]['power'], 
                            data[i]['outdoor'], 
                            data[i]['babyroom'], 
                            data[i]['updated_at'], 
                        ] );
                };
                // add the whole data to the DataTable object
                chartData.addRows(tempData);
                // create a view so that we can show/hide columns
                myView = new google.visualization.DataView(chartData);
                // the last column only contains a time stamp, remove that from the view
                var colIndex = chartData.getNumberOfColumns();
                myView.hideColumns([colIndex-1]);
                // add a listener to position the data select button once the chart is loaded
                google.visualization.events.addListener(chart, 'ready', chartLoaded);
                // draw the initial chart
                refreshGraph();
            }
        }
    );
    

    // Set options for POWER chart as an array
    pwrOptions = {
               height: 150, 
            chartArea: {width: '100%', height: '100%'},
      backgroundColor: 'LightCyan',
               legend: 'none',
                title: 'Energy demand of last 1 hour',
        titlePosition: "in",
   axisTitlesPosition: 'in',
             explorer: {},
                vAxis: {textPosition: 'in', 
                        baseline: 0,
                        gridLines: {color: 'black', count: 4},
                        minorGridLines: {color: '#333', count: 1} }
    };    
    
    // Instantiate and draw POWER chart, passing in some options.
    pwrChart = new google.visualization.AreaChart( document.getElementById('drawPwrChart') );
    pwrChartData = new google.visualization.DataTable();
    pwrChartData.addColumn('string', 'Time or Date', 'timedate');
    pwrChartData.addColumn('number', 'Power (W)', 'power');

    // request the data from the server-side DB
    // initially, we just want data from the last pre-defined time
    $.getJSON(
        baseURL+'powerlog',{
            howmuch : howmuch,
            unit    : unit
        }, 
        function(data,status){
            if (status==='success') {
                data = data["data"];
                if (data.length<1) { return; }
                // prepare the data
                pwrData =[];
                for (var i = 0; i < data.length; i++) {
                    pwrData.push( [data[i]['updated_at'].substr(11,8), data[i]['power'] ] );
                };
                // add the whole data to the DataTable object
                pwrChartData.addRows(pwrData);
                // create a view so that we can show/hide columns
                pwrView = new google.visualization.DataView(pwrChartData);
                // add a listener to position the data select button once the chart is loaded
                google.visualization.events.addListener(pwrChart, 'ready', chartLoaded);
                // draw the initial chart
                pwrChart.draw(pwrView, pwrOptions);
            }
        }
    );
    
}

// currently not used....
function chartLoaded(what) {
    $('#hours').val(hours);
    $('#days').val(days);
    
    // call the data range display dialog again, since there is no data
    if (what==='empty'){
        $('#selectData').popup('open');
    }
}




// append latest data from the server
function getLatestData() {
    // repeat this every 5 minutes
    window.setTimeout('getLatestData()',100000);
    $('#hours').val(hours);
    $('#days').val(days);
    
    // do nothing while config dialog is open
    if ( !refreshing ) { return; }

    // do nothing if there is no data
    if (chartData === undefined) { return; }

    // load the data and add it to the Google Vis dataTable
    // but we should first check if there is new data at all!
    // so what is the last row in the datatable?
    var rowIndex = chartData.getNumberOfRows();
    var colIndex = chartData.getNumberOfColumns();
    lastVal = chartData.getValue(rowIndex-1, colIndex-1);
    // get the last data record
    $.getJSON(baseURL+'templog/latest', 
        function(data,status){
            if (status==='success') {
                // was response empty?
                if (data.data===undefined||data.data===null){ return;}
                data = data["data"];
                fillTitleBar(data);
                tempData = [
                        data.updated_at.substr(11,5), 
                        data.mainroom, 
                        data.auxtemp, 
                        data.frontroom, 
                        data.heating_on, 
                        data.power, 
                        data.outdoor, 
                        data.babyroom, 
                        data.updated_at, 
                    ];

                // is this new data or still the same?
                if (data.updated_at !== lastVal) {
                    // add the new data to the DataTable object
                    chartData.addRow(tempData);
                    // re-draw the chart
                    chart.draw(myView, options);
                }
            }
        }
    );
}

// append latest data from the server
function getLatestPwrData() {
    // repeat this every 6 seconds (MKS 2015-03-12): every 10 seconds
    window.setTimeout('getLatestPwrData()',10000);
    
    // do nothing while config dialog is open
    if ( !refreshing ) { return; }

    // do nothing if there is no data
    if (pwrChartData === undefined) { return; }

    // load the data and add it to the Google Vis dataTable
    // but we should first check if there is new data at all!
    // so what is the last row in the datatable?
    // (MKS 2015-03-12): disabled, so that we write a value every second! 
    //var rowIndex = pwrChartData.getNumberOfRows();
    //lastTime = pwrChartData.getValue(rowIndex-1, 0);
    
    // get the last data record
    $.getJSON(baseURL+'powerlog/latest', 
        function(data,status){
            if (status==='success') {
                data = data["data"];
                thisTime = data.updated_at.substr(11,8);
                // is this new data or still the same?
                // (MKS 2015-03-12) if (thisTime !== lastTime) {
                    // add the new data to the DataTable object
                    pwrChartData.addRow( [ thisTime, data.power ] );
                    // re-draw the chart
                    pwrChart.draw(pwrView, pwrOptions);
                // (MKS 2015-03-12) }
                // write value in title bar (update time lag!)
                boiler_on = data.boiler_on;
                heating_on = data.heating_on;
                wrtPwrDataToTitle(data.updated_at, data.power, data.boiler_on, data.heating_on);
            }
        }
    );
}

/**
 * display individual values on the title bar
 * 
 * @param {array} data last data record
 * @returns {none} 
 */
function fillTitleBar(data) {
    
    if (data===undefined) { return; }

    // show how old the latest data is (last column is the timestamp)
    var dd = mySQLdate( data['updated_at'] ); 
    var now = new Date();
    var diff = new Date(now - dd);
    var diffSeconds = Math.floor( (now.getTime() - dd.getTime())/1000 );
    var span = '<span class="titleBarData" id="latestDataDate">';
    var disp = '(m:s) ' + span + diff.toTimeString().slice(3,8) + '</span>';
    disp = span + diffSeconds + 's&nbsp;ago</span>';
    if (diff.getHours()>0) { 
        disp = '(h:m:s)' + span + diff.toTimeString().split(' ')[0] + '</span>'; }
    $('#lblLastReading').html( disp );
    if (diff.getHours()>0 || diff.getMinutes()>9) {
        $('#lblLastReading').css({'background-color':'crimson','color':'white'});
        $('#latestDataDate').css('background-color','inherit');
    }
    else {
        $('#lblLastReading').css({'background-color':'inherit','color':'inherit'});
    }
    
    $('#showMainRoom').html( data['mainroom'] );
    $('#showFrontRoom').html( data['frontroom'] );
    $('#showHeatwater').html( data['auxtemp'] );
    $('#showLatestPower').html( data['power'] );
    
    document.title = "("+(heating_on===0?'OFF':'ON')+'|'+data['auxtemp']+'|'+data['mainroom']+'|'+data['frontroom']+') - '+docTitle;
    
    // position the last reading time display box
    var dCpos = $('#drawChart').position();
    var dCw = $('#drawChart').width();
    var lrw = $('#lblLastReading').width();
    $('#lblLastReading').css({
        'position' : 'fixed',
        'top'    : (dCpos.top)+'px',
        'left'   : (dCw - lrw)+'px',
        'z-index': 100
    });
    
}


/**
 * turns MySQL timestamp into a JS date object
 * 
 * @param {type} date in MySQL format YYYY-MM-DD HH:MM:SS
 * @returns {date} JS date object
 */
function mySQLdate(date){
    if (date) {
        var x  = date.split(' ');  // split between date and time
        var da = x[0].split('-'); // split date
        //var dt = x[1].split(':'); // split time
        return new Date(da[0]+' '+da[1]+' '+da[2]+' '+x[1]);
    }
}



/**
 * refreshes the graph and positions the data select button out of the way
 * 
 * @returns {undefined}
 */
function refreshGraph() {
    
    // only display the selected columns (in the selector panel) in the chart
    filterColumns();

    // change the chart title to reflect the scope
    if ( hours === 1 ){
        options.title = 'Data from last 1 hour';
        pwrOptions.title = 'Energy demand of last 1 hour';
    } 
    else if (hours > 1) {
        options.title = 'Data from last ' + hours + ' hours';
        pwrOptions.title = 'Energy demand of last ' + hours + ' hours';
    }
    else if (days ===1) {
        options.title = 'Data from last 1 day';
        pwrOptions.title = 'Energy demand of last 1 day';
    }
    else {
        options.title = 'Data from last ' + days + ' days';
        pwrOptions.title = 'Energy demand of last ' + days + ' days';
    }

    // re-draw the chart
    chart.draw(myView, options);
    
    // only show avg data in pwr graph
    //pwrView.hideColumns([1]);
    pwrChart.draw(pwrView, pwrOptions);
    
    // update the slider in the config popup
    $('#hours').val(hours);
    $('#days').val(days);
    //$('#hours').val(hours).slider("refresh");
    //$('#days').val(days).slider("refresh");

};



// get current power data directly from power table
function wrtPwrDataToTitle(time, power, boiler, heating) {
    $('#showLatestPower').html(power);
    var dd = mySQLdate(time);
    var now = new Date();
    var diffSeconds = Math.floor( (now.getTime() - dd.getTime())/1000 );
    $('#latestPowerTime').html("("+diffSeconds+"s ago)");
    if (diffSeconds > 50) {
        $('#latestPowerTime').css('backgroundcolor','red');
    }
    else {
        $('#latestPowerTime').css('backgroundcolor','inherit');
    }
    
    // 'translate' heating status (0 or 1) into words
    if (heating) {
        $('#showHeatingStatus').html( ' ON ' ); 
        $('#showHeatingStatus').css({'background-color':'crimson','color':'black'}); 
    } 
    else {
        $('#showHeatingStatus').html( 'OFF' );  
        $('#showHeatingStatus').css({'background-color':'inherit','color':'blue'}); 
    }
}

// get latest Logbook data record
function getLogbook() {
    // repeat this function every 100 secs
    window.setTimeout('getLogbook()',100000);
    
    // first, get last building event
    $.getJSON(baseURL+'buildinglog/latest', function(data,status) {
        if (status==='success') {
            // was response empty?
            if (data.data===undefined||data.data===null){ return;}
            data = data["data"];
            var span = '<span class="titleBarData">';
            var evtDate = mySQLdate(data.updated_at).toUTCString().slice(0,-7);
            // write data into html
            text = 'On '+span+evtDate+'</span>, '+span;
            text+= data.what+'</span>in the '+span+data.where+' room';
            text+= '</span>was switched '+span+data.text+'</span>';
            $('#showBuildingLog').html(text);
        }
    });
    
    // do nothing as long as the events haven't been loaded
    if (!events) {return;}
    
    $.getJSON(baseURL+'eventlog/latest', function(data,status) {
        if (status==='success') {
            // was response empty?
            if (data.data===undefined||data.data===null){ return;}
            data = data["data"];
            // turn timestamp into a Date object
            var eventDate = mySQLdate(data.updated_at);
            // look up the events table to get the event details
            todaysEvent = events[getTodaysEvent(data.event_id)];
            if (!todaysEvent) {
                $('#showLogbook').html("Event not found - perhaps event data was modified recently");
                return;
            }  
            // write data into html
            showLogbookReport(data,todaysEvent,eventDate);
        }
    });
}

function getTodaysEvent(eventID) {
    for (var i=0; i<events.length; i++) {
        if (1*events[i].id === eventID) {
            return i;
        }
    }
}
function showLogbookReport(log,event,evtDt){
    var text;
    var span = '<span class="titleBarData">';
    // is the last entry in the logbook from yesterday or older?
    var midnight = new Date(); 
    midnight.setHours(0,0,0);
    if (evtDt < midnight) {
        text = span + event.title + '</span> (ID:'+log.event_id+'), finished at ' + span
                + event.end.substr(0,5) + '</span> and heating was switched off at '+span + log.actualOff.substr(0,5);
    }
    else // today's event, mark it in the event table
    {
        if (log.estimateOn !== "00:00:00" || log.actualOn !== "00:00:00") {
            $("[data-index="+log.event_id+"]").css({
                "background-color":"khaki",
                     "font-weight":"bold"
            });
        }
        if (log.estimateOn !== "00:00:00") {
            text = span +  event.title + '</span> (ID:'+log.event_id+') starts at ' + span + event.start 
                    + '</span>, heating will be switched on around ' + log.estimateOn;
        }
        if (log.actualOn !== "00:00:00") {
            text = span +  event.title + '</span> (ID:'+log.event_id+') starts at ' + span + event.start 
                    + '</span>, heating was switched on at ' + log.actualOn;
        }
        if (log.actualOff !== "00:00:00") {
            text = span +  event.title + '</span> (ID:'+log.event_id+') ended at ' + span + event.end 
                    + '</span>, heating was switched OFF at ' + log.actualOff;
            $("[data-index="+log.event_id+"]").css({
                "background-color":"initial",
                     "font-weight":"initial"
            });
        }
    }
    
    $('#showLogbook').html(text);
}

/**
 * Get the heating program events from the backend DB and
 * - populate the events table
 * - make the table editable if all status are 'OK'
 *
 * @param {string} where Set to 'Mobile' in order to access the correct DOM element on mobile devices
 * 
 * @returns {undefined}
 */
function getEvents(where) {
    // populate the events table
    $.getJSON( baseURL+'events', 
        function( data, status ) {
            if (status==='success') {
                data = data["data"];
                events = data;
                var dbOK = true;
                var r = new Array(), j = -1;
                for (var key=0, size=data.length; key<size; key++) {
                    r[++j] = '<tr data-index="'+data[key]['id']+'">';
                    r[++j] = '<td class="edit" id="title">';
                    r[++j] = data[key]['title'];
                    r[++j] = '</td><td>';
                    r[++j] = data[key]['id'];
                    r[++j] = '</td><td class="editWeekday" id="weekday">';
                    r[++j] = data[key]['weekday'];
                    r[++j] = '</td><td class="edit" id="start">';
                    r[++j] = data[key]['start'];
                    r[++j] = '</td><td class="edit" id="end">';
                    r[++j] = data[key]['end'];
                    r[++j] = '</td><td class="edit" id="targetTemp">';
                    r[++j] = data[key]['targetTemp'];
                    r[++j] = '</td><td class="editRepeats" id="repeats">';
                    r[++j] = data[key]['repeats'];
                    r[++j] = '</td><td class="edit" id="nextdate">';
                    r[++j] = data[key]['nextdate'];
                    r[++j] = '</td><td class="edit" id="rooms">';
                    r[++j] = data[key]['rooms'];
                    r[++j] = '</td><td>';
                    r[++j] = data[key]['status'];
                    r[++j] = '</td><td>';
                    r[++j] = data[key]['updated_at'];
                    r[++j] = '</td></tr>';
                    if ( data[key]['status'] !== 'OK' ) {  dbOK = false;   }
                }
                
                // write the table body with the new data                
                if (where !== 'mobile') {
                    $('#tblEventsBody').html(r.join('')); 
                    $('#tblEvents').table('rebuild');
                    
                    // make cells editable if DB status is OK
                    if (dbOK) { 
                        tableEditable(); }
                    else {
                        $('#tblEventsBody').click(function(){
                            $('#popupMsg').popup('open');
                            $('#popupMsgText').text('Events table is locked, because last change has not been processed yet.');
                        }); 
                    }
                    var d = new Date();
                    $('#lblEventsTblLoaded').html('Last read of events table: ' + d.toLocaleTimeString() );
                }
                // on mobiles (or small displays) attach the data to a different DIV
                else {
                    $('#tblEventsBodyMobile').html(r.join('')); 
                }
                
                // refresh events table every so often ....
                // more often when we're waiting for a change to be accepted
                if (dbOK) { 
                    window.setTimeout('getEvents()',1000000); }
                else {
                    window.setTimeout('getEvents()',100000);
                }
            }
    });
}



function tableEditable() {
            
    // create generic input fields 
    $('.edit').editable('updEvents.php',{
        submitdata : function() {
            var tan = window.prompt("Enter TAN:",0);
            return {index: this.parentNode.dataset.index, tan: tan};
        },
        callback : function(value) {
            checkEditResult(value,this);
        }
    });

    // create a drop-down-list for the weekdays field
    $('.editWeekday').editable('updEvents.php',{
        data    : "{'Sunday':'Sunday','Monday':'Monday','Tuesday':'Tuesday','Wednesday':'Wednesday','Thursday':'Thursday','Friday':'Friday','Saturday':'Saturday'}",
        type    : 'select',
        submit  : 'OK',
        submitdata : function() {
            var tan = window.prompt("Enter TAN:",0);
            return {index: this.parentNode.dataset.index, tan: tan};
        },
        callback : function(value) {
            checkEditResult(value,this);
        }
    });

    // create a drop-down-list for the Repeats field
    $('.editRepeats').editable('updEvents.php',{
        data    : "{'once':'once','weekly':'weekly','biweekly':'biweekly','monthly':'monthly'}",
        type    : 'select',
        submit  : 'OK',
        submitdata : function() {
            var tan = window.prompt("Enter TAN:",0);
            return {index: this.parentNode.dataset.index, tan: tan};
        },
        callback : function(value) {
            checkEditResult(value,this);
        }
    });
    
}

/**
 * check if change was successful and only then refresh the events table
 * 
 * @param {type} value
 * @param {type} that
 * @returns {undefined}
 */
function checkEditResult(value,that) {
    if ( value.indexOf('ERROR') < 0 ) // was there even a change?
    {
        getEvents();  // re-load the events table
    }
}



function requestTAN(forWhat) {
    if (forWhat==='events') {
        $.post(
            'updEvents.php',
            {
                index   : $('#tblEventsBody').children().first().data().index,
                id      : 'status',
                value   : 'TAN-REQ'
            }, 
            function(data) {
                $('#reqTANresult').html(data); 
                getEvents();
            }
        );
    }
}

/**
 * submit changed heating control settings 
 * 
 * @returns {undefined}
 */
function submitSettings() {
    // first check if there were any changes
    if ( checkChangedHeatSettings() ) { 
        $('#updHeatSetResult').html('No Change!');
        return; }
    
    // AJAX to update settings
    $.post("updHeatingControl.php", 
        {
            tan : $('#controlTAN').val(),
            h   : $("input[name='inpHeatingMode']:checked").val(),
            aob : $('#autoOnBelow').val(),
            aoa : $('#autoOffAbove').val(),
            iph : $('#increasePerHour').val()
        },
        function(data) {
            if ( data.indexOf('ERROR') < 0 ) {
                location.href = '#';  // close the dialog
                return;
            }
            $('#updHeatSetResult').html('Result: '+data);
        }
    );

}
function checkChangedHeatSettings() {
    var noChg = true;
    if ( heatingControl.heating         !== $("input[name='inpHeatingMode']:checked").val() )
        { noChg = false; }
    if ( heatingControl.autoOnBelow     !== $('#autoOnBelow').val() )
        { noChg = false; }
    if ( heatingControl.increasePerHour !== $('#increasePerHour').val() )
        { noChg = false; }
    if ( heatingControl.autoOffAbove    !== $('#autoOffAbove').val() )
        { noChg = false; }
    return noChg;
}


/**
 * select or deselect all options (columns)
 * 
 * @param {obj} that DOM object from which this function was called
 * @returns {undefined}
 */
function selectAllCols(that) {
    // iterate through each select boxes (bar the first one)
    for (n=1;n<$('[name="selectCols"]').length;n++) {
        if (that.checked===false 
            && $('[name="selectCols"]')[n].checked 
            && n!==5 ) {
                $('[name="selectCols"]')[n].click(); }
        if (that.checked===true 
            && $('[name="selectCols"]')[n].checked===false
            && n!==5 ) {
                $('[name="selectCols"]')[n].click(); }
    }
}


/**
 * pre-select certain column types for the graph
 * 
 * @returns {undefined}
 */
function showTempsOnly() {
    switch ( $("input[name=chbxWhat]:radio:checked").attr("id") ) {
        case 'chbxAll':
            $('#chbAll').prop('checked','');
            $('#chbAll').click();
            $('#chbAll').click();
            $('#chbAll').click();
            break;
        case 'chbxRoomTemp':
            $('#chbAll').prop('checked','');
            $('#chbAll').click();
            $('#chbAll').click();
            $('#chbMainroom').prop('checked','checked').checkboxradio( "refresh" );
            $('#chbFrontroom').prop('checked','checked').checkboxradio( "refresh" );
            break;
        default:
    }    
    // now refresh the graph
    refreshGraph();
}




function plus1h() {
    hours+=1;
    if (hours>1) { $('#minus1h').show(); }
    drawChart();
}
function minus1h() {
    hours-=1;
    if (hours===1) { $('#minus1h').fadeOut('slow'); }
    drawChart();
}
function show24h() {
    hours=24;
    $('#minus1h').show();
    drawChart();
}
function show7days() {
    hours=0;
    days=7;
    drawChart();
}


/**
 * Checks the checkboxes in the panel to see which columns to show in the graph
 * 
 * - called from the OK button in the data selection panel
 * @returns {undefined}
 */
function selectColumns() {
    
    // close the panel
    $('#selectData').popup('close');

    // has the date range been changed?
    var newDays = 1 * $('#days').val();
    var newHours = 1 * $('#hours').val();
    if (newDays!==days 
    || newHours!== hours
    || myView===undefined ) {
        days=newDays;
        hours=newHours;
        drawChart();
        $('#hours').val(hours);
        $('#days').val(days);
        return;
    }
    
    
    // reject this if no data column was selected
    var chkCount=0;
    for (n=1;n<$('[name="selectCols"]').length;n++) {
        if ( $('[name="selectCols"]')[n].checked ) {
            chkCount++; }
    }

    if (chkCount===0) {
        
        $('#popupMsg').popup('open');
        $('#popupMsgText').text('Choose at least one data column!');
        $('#popupMsg-popup').position({my:'right top',at:'right bottom',of:'#fldColSelect'});
        
        // open the panel again
        $('#selectData').popup('open');
        
        return;
    }
    
    // draw the chart again
    refreshGraph();
}


/**
 * make sure only the selected columns (from the selector panel)
 * are being displayed in the chart
 * 
 * @returns {undefined}
 */
function filterColumns() {
    if (!myView) {return;}
    // (myView contains the chart data)
    myView.setColumns([0,1,2,3,4,5,6,7]); // make all visible first
    // now hide columns whose checkbox is not checked 
    for (n=1;n<$('[name="selectCols"]').length;n++) {
        if (!document.getElementsByName('selectCols')[n].checked) {
            myView.hideColumns([(n)]); }
    }
    // for now, hide power data
    myView.hideColumns([(5)]);
}


// what to do when DOM is loaded
$(document).ready(function(){

    // retain the original document title
    docTitle = document.title;

    // hide the "minus 1 hour" button if hour is already at 1
    if (hours===1) { $('#minus1h').hide(); }

    // unhide the data display button
    $('#btnSelData').show();
    // populate the chart title and the input sliders
    $('#showDataRange').show();
    //$('#days').val(days).slider("refresh");
    //$('#hours').val(hours).slider("refresh");

    // stop refreshing while selection dialog is visible
    $("#selectData").on('popupafteropen', function(){
        refreshing = false;
    });
    $("#selectData").on('popupafterclose', function(){
        refreshing = true;
    });

    // check for new data every 100 secs
    window.setTimeout('getLatestData()',100000);
    window.setTimeout('getLatestPwrData()',10000);
    
    if (isMobile.matches) {        
        // check orientation and on mobile devices,
        // - make the footer only fix in portrait orientation
        orientationChange();        
        // remove events div on page 1
        $('#tblContainer').hide();
        // built events table on page 4
        getEvents('mobile');
    }
    else {
        // built events table on page 1
        getEvents();
    }
    
    // create popups
    $('#selectData').popup();
    $('#popupMsg').popup();
    
    // get today's logbook data (if any)
    getLogbook();
    
    // position the last reading time display box
    $('#lblLastReading').height($('.titleBarLbl'));

    // hide unused checkbox
    $('#chbOther').parent().hide();
    
});


// what to do once the page is created
$(document).on("pagecreate", function () {

    // if one slider is moved the other one is reset to 0
    function resetSlider(e) {
        var current = $(e.target)[0].id,
            hours = "hours",
            days = "days";
        if (current == days) {
            $("#hours")
                .off("change")
                .val(0)
                .on("change", resetSlider);
        };
        if (current == hours) {
            $("#days")
                .off("change")
                .val(0)
                .on("change", resetSlider);
        };
        // removed: .slider("refresh")
    }
    // activate change event on the sliders to call above function
    $("#days, #hours").on("change", resetSlider);
});


// call the refreshGraph function if the window is resized
var resizeTimer;
$(window).resize(function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refreshGraph, 500);

    // position the last reading time display box
    var dCpos = $('#drawChart').position();
    var dCw = $('#drawChart').width();
    var lrw = $('#lblLastReading').width();
    $('#lblLastReading').css({
        'position' : 'fixed',
        'top'    : (dCpos.top)+'px',
        'left'   : (dCw - lrw)+'px',
        'z-index': 100
    });
    
});


// enable jQ UI tooltips
$(function() {
    $( document ).tooltip();
});


// show 'loading' GIF while waiting for AJAX data
$(document
    ).ajaxStart(function(){
        $("body").append("<div id='ajaxLoading'><img src='images/ajax-loader.gif' /></div>");
    }).ajaxStop(function(){
        $('#ajaxLoading').remove();
    });


// make footer fixed or not depending on orientation
$(window).on("orientationchange",function(){
//    orientationChange(); // currently void
});


// check if the token has expired
function checkToken() {
    var now = new Date();
    if (oauth.expire - now < 1) { // request a new token
        $.ajax({
            type: 'POST',
            url: baseURL+oauth.url,
            dataType: 'json',
            async: false,
            success: function(data) {
                oauth.accToken = data.access_token;
                oauth.expire = data.expires_in;
            }
        });
    }
}

/**
 * get Heating Control Settings data via AJAX and fill form
 * 
 * @returns {undefined}+
 */
function getHeatingControl() {

    // first make sure we have a valid oauth token
    checkToken();
    
    // send a request together with the token
    $.getJSON(baseURL+"settings?access_token="+oauth.accToken,
        function(data,status){
            if (status==='success') {
                heatingControl=data["data"];
                
                // fill settings form
                switch (heatingControl.heating) {
                    case 'AUTO':
                        $("input[name='inpHeatingMode'][value='AUTO']").prop("checked",true);
                        break;
                    case 'ON':
                        $("input[name='inpHeatingMode'][value='ON']").prop("checked",true);
                        break;
                    case 'OFF':
                        $("input[name='inpHeatingMode'][value='OFF']").prop("checked",true);
                        break;
                    default:
                }
                
                $('#autoOnBelow').val(heatingControl.autoOnBelow);
                $('#autoOffAbove').val(heatingControl.autoOffAbove);
                $('#increasePerHour').val(heatingControl.increasePerHour);
         
                location.href = '#pupSettings';    

            }
        }
    );
   
}