//import sweetalert;
var vApp;
var socket;
function init(){
	//moves user info from the top of the html page to into the nav bar
	var user = $('#user').detach();
	$('#logo').after(user);

	//Vue app used for template in search.html
	vApp = new Vue({
		el: "#app",
		data: {
			//data from optional course number input box
			courseNumberSearch: '',
			//data from optional crn input box
			crnNumberSearch: '',
			//array of objects from the SQL Departments table, filled by function getDepts()
			departments: [],
			//array of object from the SQL courses and sections tables, filled by fillTable()
			searchResults: [],
			//Users login
			login: '',
			//Users positon
			position: '',
			//Results from faculty pressing view roster button, array of objects containing university_id, first_name, last_name
			viewRosterResults: [],
			//Holds the crn that has been requested to view the roster of
			viewRegCRN: '',
			//An array list of objects containing course number, crn, times, subject and name
			registeredCourses: [],
			
			////An array list of objects containing course number, crn, times, subject and name for the wishlist
			wishlistCourses: []
		},
		//Watchers for when searchResults or registeredCourses arrays change in order to change color
		watch: {
			searchResults: function(value){
				this.$nextTick(()=>{
					var i;
					var x;
					for(i=0;i<vApp.searchResults.length; i++){
						x = document.getElementById(vApp.searchResults[i].CRN + 'color').style.backgroundColor = '#d1d3d2';
					}
					for(i=0;i<vApp.registeredCourses.length; i++){
						x = document.getElementById(vApp.registeredCourses[i].crn + 'color');
						console.log(x);
						if(x != null){
							x.style.backgroundColor = '#45e86e';
						}
						else{
							//making sure that crn is string before doing a substring 
							vApp.registeredCourses[i].crn = vApp.registeredCourses[i].crn.toString();
							var y = vApp.registeredCourses[i].crn.substring(1,vApp.registeredCourses[i].crn.length);
							x = document.getElementById(y + 'color');
							if(x != null){
								x.style.backgroundColor = '#e6ed87';
							}
						}
					}
				});
			},
			registeredCourses: function(value){
					var i;
					var x;
					for(i=0;i<vApp.searchResults.length; i++){
						x = document.getElementById(vApp.searchResults[i].CRN + 'color').style.backgroundColor = '#d1d3d2';
					}
					for(i=0;i<vApp.registeredCourses.length; i++){
						console.log("here" + vApp.registeredCourses[i].crn);
						x = document.getElementById(vApp.registeredCourses[i].crn + 'color');
						//console.log(x);
						if(x != null){
							x.style.backgroundColor = '#45e86e';
						}
						else{
							//making sure crn is a string before doing substring 
							var y = vApp.registeredCourses[i].crn.toString();;
							var z = y.substring(1,vApp.registeredCourses[i].crn.length);
							x = document.getElementById(z + 'color');
							if(x != null){
								x.style.backgroundColor = '#e6ed87';
							}
						}
					}
					
			}
		}, //watch
		//Computed search tables  function used to set checkboxes in columns of 3
		computed: {
			//Adjust for remainder total of 94 subjects , ask what problem is
			searchTables: function(){
				var result = [];
				var row;
				var i;
				var col = 0;
				for(i = 0; i < this.departments.length; i++){
					if (col === 0) {
						row = [];
						result.push(row);
					}

					row.push(this.departments[i]);

					col = (col + 1) % 3
				}

				console.log(result);
				return result;
			}

		}, //computed
		methods:{

			/*timeConflict(time){
				console.log("time: ")
				console.log(time)
				return true;

			},*/

			inCourse(crn){
				var index;
				for(index = 0; index < vApp.registeredCourses.length; index++){
						if(crn == vApp.registeredCourses[index].crn){
							return true;
						}
						if(vApp.registeredCourses[index].crn[0] === 'W'){
							if(crn == vApp.registeredCourses[index].crn.substring(1)){
								return true;
							}
							
						}
		
				}
				return false;
				
			},
			inWish(crn){
				var index;
				//console.log(crn)
				for(index = 0; index < vApp.wishlistCourses.length; index++){
						if(crn == vApp.wishlistCourses[index].crn){
							return true;
						}
		
				}
				return false;
				
			}
			
		}//methods
	});

	document.getElementsByClassName("hideInfo").display = "none";
	getDepts();

	//Call to getLogin to parse the HTML containing the users id
	vApp.login = getLogin();

	//Call to getPosition function to get request the position of the user
	//Gets all of the users data from the SQL people table, do this once after login or after each search?
	getPosition();

	//These are used to create a loading animation for each time data is requested from a server, and to end that animation when data is received
	$( document ).ajaxStart(function() {
			NProgress.start();
	});
	$( document ).ajaxStop(function() {
			NProgress.done();
	});
	//console.log(vApp.position);
	if(vApp.position == 'faculty'){ 
	console.log("line 170");
		var a = document.getElementById("schedBut");
		var b = document.getElementById("wishBut");
		
		a.style.display = 'none';
		b.style.display = 'none';
	}
	
	
	//------Here to end of init function is websocket functionality 
	socket = io.connect();
	
    socket.on('connect', () => {
        console.log("Connection successful!");
    });
	
	//When user registers increase the section register amount for everyone if currently searching the same page (and recall view roster for faculty)
    socket.on('addRegister', (crn) => {
		for(i=0; i < vApp.searchResults.length; i++){
			if(crn == vApp.searchResults[i].CRN){
				vApp.searchResults[i].registered = vApp.searchResults[i].registered +1;
			}
		}
		if(vApp.position === 'faculty' && crn == vApp.viewRegCRN){
			viewRoster(crn);
		}
    });
	
	//When a user added to a waitlist increase waitlist count if currently searching the same page (and recall view roster for faculty)
	socket.on('addWaitlist', (crn) => {
		for(i=0; i < vApp.searchResults.length; i++){
			if(crn == vApp.searchResults[i].CRN){
				vApp.searchResults[i].waitlist = vApp.searchResults[i].waitlist +1;
			}
		}
		if(vApp.position === 'faculty' && crn == vApp.viewRegCRN){
			viewRoster(crn);
		}
    });
	
	//If a user drops a course update the counts for everyone currently searching for the same section and recall view roster for faculty update
	socket.on('dropCourse', (crn,field) => {
		for(i=0; i < vApp.searchResults.length; i++){
			if(crn == vApp.searchResults[i].CRN){
				if(field === 'W'){
					vApp.searchResults[i].waitlist = vApp.searchResults[i].waitlist -1;
				}
				if(field === 'R'){
					vApp.searchResults[i].registered = vApp.searchResults[i].registered -1;
				}
			}
		}
		
		if(vApp.position === 'faculty' && crn == vApp.viewRegCRN){
			viewRoster(crn);
		}
    });
	
	//Log = the user login who moved from waitlist to register for a course. If you're this student update your registered courses and change the color of your section
	//Note: the update color is really only necessary if the user is currently searching for the exact same section. Otherwise will be auto updated when your reclicks search. 
	socket.on('waitToReg', (crn,log) => {
		if(log == vApp.login){
			var i;
			
			for(i = 0; i < vApp.registeredCourses.length; i++){
				if(vApp.registeredCourses[i].crn[0] === 'W'){
						if(crn == vApp.registeredCourses[i].crn.substring(1)){
							vApp.registeredCourses[i].crn = vApp.registeredCourses[i].crn.substring(1);
							var q;
							for(q=0; q < vApp.searchResults.length; q++){
								if(crn == vApp.searchResults[q].CRN){
									var x = document.getElementById(vApp.registeredCourses[i].crn +'color');
									x.style.backgroundColor= "#45e86e";
								}
							}
							swal("You have been moved off the waitlist for "+crn + " and are now registered","","success" );
						}		
					}
			}
		
		}
    });
	
	
	
	
}//init

//register for all classes in wishlist
function regForAll(){
	var i;
	for(i=0;i<vApp.wishlistCourses.length; i++){
		register(vApp.wishlistCourses[i].crn);
	}
}

function showSub(){
	var x = document.getElementById("list");
	if (x.style.display !== "block"){
		x.style.display = "block";
	}else{
		x.style.display = "none";
	}
	var y = document.getElementById("code");
	if(y.innerHTML == '+'){
		y.innerHTML = '-';
	}else{
		y.innerHTML = '+';
	}
	console.log(y.innerHTML);
	console.log(x);
}

//gets the subject and full name for each department from our SQL departments table, used for filling our template of checkboxes
function getDepts(){
	var settings = {
		"async": true,
		"crossDomain": true,
		"url": "/depts",
		"method": "GET"
	}
	$.ajax(settings).done(function (response) {
		vApp.departments = response;
	});
}

//for table click functionality
function reveal(crn, times){
	var x = document.getElementById(crn).style;
	if(x.display == 'none'){
		x.display = 'table-row';
	}
	else if(x.display == 'table-row'){
		x.display = 'none';
	}
	loadthis(crn+'time',times);
}

//for schedule time formatting
function makeThisWork(){
	
	var i;
	console.log(vApp.registeredCourses.length);
	for(i=0;i<vApp.registeredCourses.length;i++){
		console.log("here");
		loadthis(vApp.registeredCourses[i].crn+'scheduleTime',vApp.registeredCourses[i].times);
	}
}

//putting time in individual table slots
function loadthis(id,timeTable){
	console.log('here');
	var times = '';
	var x = JSON.parse(timeTable);
	//console.log(x.T);
	if(x.M != null){
		times += "M " +x.M;
	}
	if(x.T != null){
		times += "T " +x.T;
	}
	if(x.W != null){
		times += "W " +x.W;
	}
	if(x.R !=  null){
		times += "R " +x.R;
	}
	if(x.F != null){
		times += "F " +x.F;
	}
	if(x.SA != null){
		times += "SA " +x.SA;
	}
	if(x.SU != null){
		times += "SU " +x.SU;
	}
	document.getElementById(id).innerHTML = times;
}

//Used to check if a user hass previously searched from the page, if so clear the searchResults array before the next search begins
function checkStatus(){
	if(vApp.searchResults.length >0){
		vApp.searchResults = [];
	}
	fillTable();
}

//Method sends a post request to our server to obtain all needed information for the subjects selected by the user
function fillTable(){

			var index;
			var urlString = ''
			var atLeastOneChecked = false;

			//Used to start loading animation when searching for a table
			//NProgress.start();

			//Builds up our url based on checked subjects
			//Adds a '-' for parsing by the server
			for(index =0; index < vApp.departments.length; index++){
				var x = document.getElementById(vApp.departments[index].subject);
				if (x.checked == true){
					urlString += x.id + '-';
					atLeastOneChecked = true;
				}
			}
			//If the user has selected at least one checkbox
			if(atLeastOneChecked){

				urlString = urlString.substring(0, urlString.length-1);

				//If user searches a specific course number add to URL
				if(vApp.courseNumberSearch !== ''){

					urlString += '+' + vApp.courseNumberSearch

					if(vApp.crnNumberSearch == ''){
						urlString += '+'
					}
				}
				//If user searches a specific CRN add to URL
				if(vApp.crnNumberSearch !== ''){
					if(vApp.courseNumberSearch == ''){
						urlString += '+'
					}
					urlString += '+' + vApp.crnNumberSearch
				}

				var settings = {
					"async": true,
					"crossDomain": true,
					"url": "/search/"+urlString,
					"method": "POST"
				}

				$.ajax(settings).done(function (response) {
					if(response !== 'Bad'){
						var i;
						var sub;
						var cNum;
						var cred;
						var cName;
						var des;
						//Fills searchResults in the vApp
						for(i = 0; i < response.length; i++){
							sub = response[i].subject;
							cNum = response[i].course_number;
							sNum = response[i].section_number;
							cName =  response[i].name;
							build = response[i].building;
							roomNumber = response[i].room;
							prof = response[i].professors;
							cred = response[i].credits
							crn = response[i].crn;
							time = response[i].times;
							des = response[i].description;

							cap = response[i].capacity;
							reg = getRegCount(response[i].registered,cap);
							wait = getWaitCount(response[i].registered,cap); //will have to manually calculate, something like if registered > capacity

							vApp.searchResults.push({
								subject: sub,
								course_number: cNum,
								section_number: sNum,
								course_name: cName,
								building: build,
								room: roomNumber,
								professors: prof,
								credits: cred,
								CRN: crn,
								times: time,
								description: des,
								registered: reg,
								capacity: cap,
								waitlist: wait
							});
						} //for(i = 0; i < response.length; i++)


						//console.log(response);
					}//if!== Bad
					else{
						alert("Please enter only integers into the search boxes");
						
					}

				}) //ajax(settings)
			} //if(atLeastOneChecked)
			else{
				alert("Please choose at least one subject box");
				//console.log("Must select at least one subject");

			}
} //fillTable

//next three functions are for navbar utility
function getReg(){
	console.log("getreg");
	var x = document.getElementById("register");
	var y = document.getElementById("schedule");
	var z = document.getElementById("wishlist");
	var a = document.getElementById("schedBut");
	var b = document.getElementById("wishBut");
	var c = document.getElementById("regBut");

	x.style.display = 'block';
	y.style.display = 'none';
	z.style.display = 'none';
	a.style.display = 'block';
	b.style.display = 'block';
	c.style.display = 'none';
}
function getSched(){
	makeThisWork();
	console.log("getsched");
	var x = document.getElementById("register");
	var y = document.getElementById("schedule");
	var z = document.getElementById("wishlist");
	var a = document.getElementById("schedBut");
	var b = document.getElementById("wishBut");
	var c = document.getElementById("regBut");

	x.style.display = 'none';
	y.style.display = 'block';
	z.style.display = 'none';
	a.style.display = 'none';
	b.style.display = 'block';
	c.style.display = 'block';
}
function getWish(){
	console.log("getwish");
	var x = document.getElementById("register");
	var y = document.getElementById("schedule");
	var z = document.getElementById("wishlist");
	var a = document.getElementById("schedBut");
	var b = document.getElementById("wishBut");
	var c = document.getElementById("regBut");

	x.style.display = 'none';
	y.style.display = 'none';
	z.style.display = 'block';
	a.style.display = 'block';
	b.style.display = 'none';
	c.style.display = 'block';
}

//function getLogin is used to parse the html written in the search.html page to store the user's login
function getLogin(){

	var fromSearch = document.getElementById('user').innerHTML;
	var parsed = fromSearch.split(":");
	var login = parsed[1].trim();
	return login;

}

//function gets the position (student or faculty) and stores it in our vApp
function getPosition(){
	var info = {
				"async": true,
				"crossDomain": true,
				"url": "/position/"+vApp.login,
				"method": "GET"
			   }

	$.ajax(info).done(function (response) {
			//Obtain the users registered courses data and set it in the Vue App
			console.log(response);
			
			if(response !== 'student' && response !== 'faculty'){
				vApp.registeredCourses = response.courses;
				vApp.position = response.position;
			}
			else{
			//Set the position of the user in the Vue app
				vApp.position = response
			}
			if(vApp.position == 'faculty'){ 
				var a = document.getElementById("schedBut");
				var b = document.getElementById("wishBut");
				
				a.style.display = 'none';
				b.style.display = 'none';
			}
			
	});


}

//Function sends a post request to homePage when a student registers for a class
function register(crn){
	var urlString = '';
	urlString = vApp.login+'+'+crn
	var settings = {
				"async": true,
				"crossDomain": true,
				"url": "/register/"+urlString,
				"method": "POST"
			   }

	$.ajax(settings).done(function (response) {
			//If student is clear to register push the crn to the registeredCourses array to change the color and increase the count
			var inSearch = false;
			if(response === 'R'){
				var i;
				for(i=0; i < vApp.searchResults.length; i++){
					if(crn == vApp.searchResults[i].CRN){
						inSearch = true;
						var x = {
							course_number: vApp.searchResults[i].course_number,
							crn: vApp.searchResults[i].CRN,
							name: vApp.searchResults[i].course_name,
							subject: vApp.searchResults[i].subject,
							times: vApp.searchResults[i].times
						}
						vApp.registeredCourses.push(x);
					}
				}
				//If when registering the crn is not in the current search results (i.e. registered through wishlist but user searched new subject)
				if(inSearch === false){
					
					for(i=0; i < vApp.wishlistCourses.length; i++){
						if(crn == vApp.wishlistCourses[i].crn){
							inSearch = true;
							var y = {
								course_number: vApp.wishlistCourses[i].course_number,
								crn: vApp.wishlistCourses[i].crn,
								name: vApp.wishlistCourses[i].name,
								subject: vApp.wishlistCourses[i].subject,
								times: vApp.wishlistCourses[i].times
							}
							vApp.registeredCourses.push(y);
						}
					}
					
					
				}
				console.log("registering now, should change color");
				//Send to server to update everyone
				socket.emit('addRegister',crn);
			}
			//If student is on the waitlist push the crn with a W to the registeredCourses array to change the color and increase the count
			if(response === 'W'){
				var i;
				var inSearch2 = false;
				for(i=0; i < vApp.searchResults.length; i++){
					if(crn == vApp.searchResults[i].CRN){
						inSearch2 = true;
						var x = {
							course_number: vApp.searchResults[i].course_number,
							crn: "W" + vApp.searchResults[i].CRN,
							name: vApp.searchResults[i].course_name,
							subject: vApp.searchResults[i].subject,
							times: vApp.searchResults[i].times
						}
						var y = document.getElementById(vApp.searchResults[i].CRN + "color");
						vApp.registeredCourses.push(x);
					}

				}
				//If registering for waitlist and user searched new subject (registered from wishlist)
				if(inSearch2 === false){
					
					for(i=0; i < vApp.wishlistCourses.length; i++){
						if(crn == vApp.wishlistCourses[i].crn){
							inSearch = true;
							var y = {
								course_number: vApp.wishlistCourses[i].course_number,
								crn: "W"+vApp.wishlistCourses[i].crn,
								name: vApp.wishlistCourses[i].name,
								subject: vApp.wishlistCourses[i].subject,
								times: vApp.wishlistCourses[i].times
							}
							vApp.registeredCourses.push(y);
						}
					}
					
					
				}
				
				//Send to server to update everyone
				socket.emit('addWaitlist',crn);
			}
			
			//To remove from wishlist if they click the register button but course on wishlist
			dropFromWish(crn);
	});

}


//Function sends a post request to the server when a faculty selects the view roster button
function viewRoster(crn){
	vApp.viewRegCRN = crn;
	var settings = {
				"async": true,
				"crossDomain": true,
				"url": "/roster/"+crn,
				"method": "POST"
			   }

	$.ajax(settings).done(function (response) {
			vApp.viewRosterResults = response;
			//console.log(vApp.viewRosterResults);

	});


}
//Clean is a prestep for the view schedule drop button, before calling the drop class function make sure only pass crn without a W
function clean(crn){
	if(crn[0] === 'W'){
		
		dropClass(crn.substring(1));
	}
	else{
	
		dropClass(crn);
	}
	
}
//Function drop class is used to send a post request to the server when a user desires to drop a class, takes the crn of the course to drop
//NOTE: On next part of project when add web sockets, will need to add ability to also adjust the registered courses for the user moving off the waitlist 
function dropClass(crn){
	var urlString = '';
	urlString = vApp.login+'+'+crn;
	console.log(crn);
	var settings = {
				"async": true,
				"crossDomain": true,
				"url": "/drop/"+urlString,
				"method": "POST"
			   }
	$.ajax(settings).done(function (response) {
		var i;
		console.log(response);
		//On a dropped class the server will respond with nullR if noone moved from waitlist and registered student dropped, nullW is noone moved from waitlist and waitlist student dropped or the login of the user moved from waitlist to register 
		var login = response;
		if(login !== 'nullR' && login !== 'nullW'){
			login = response;
			console.log(login);
			socket.emit('waitToReg',crn,login);
		}
		
		for(i = 0; i < vApp.registeredCourses.length; i++){
				if(vApp.registeredCourses[i].crn[0] === 'W'){
					if(crn == vApp.registeredCourses[i].crn.substring(1)){
						vApp.registeredCourses.splice(i,1);
					}
								
				}
				
				else if(crn == vApp.registeredCourses[i].crn){
					vApp.registeredCourses.splice(i,1);
				}	
				
		}
		
		//If dropped course was from a student on the waitlist 	
		if(login === 'nullW'){
			socket.emit('dropCourse',crn,'W');
		}
		//If dropped course from student on the registered list and no waitlist 
		else if(login === 'nullR'){
			socket.emit('dropCourse',crn,'R');
		}
		//If dropped course from a registered student and there was a student on the waitlist 
		else if(login !== 'nullR' && login !== 'nullW'){	
			socket.emit('dropCourse',crn,'W');
		}		
			
		
	
	});
	
}//function dropClass(crn)

//Function calculates the amount of registered students to display in the search table
function getRegCount(list,capacity){

	if(list === null){
		return 0;

	}

	else{
		list = list.split(',');
		if(list.length > capacity){
			return capacity;
		}
		return list.length;
	}



}

//Function calculates the amount of waitlisted students to display in the search table
function getWaitCount(list,capacity){
	if(list === null){
		return 0;

	}

	else{
		list = list.split(',');
		if(list.length > capacity){
			return list.length - capacity;
		}
		return 0;
	}

}

//Called when a user clicks the addToWishlist button 
function addToWish(crn){
	
	var i;
	for(i=0; i < vApp.searchResults.length; i++){
		if(crn == vApp.searchResults[i].CRN){

			var buildWishlist = {
				course_number: vApp.searchResults[i].course_number,
				crn: vApp.searchResults[i].CRN,
				name: vApp.searchResults[i].course_name,
				subject: vApp.searchResults[i].subject,
				times: vApp.searchResults[i].times
			}
			vApp.wishlistCourses.push(buildWishlist);
		}

	}
	
	
}

//Called when user clicks drop from wishlist button or if user has course on wishlisht but registers for it on search page 
function dropFromWish(crn){
	var index;
	
	for(index = 0; index < vApp.wishlistCourses.length; index++){
			if(crn == vApp.wishlistCourses[index].crn){
				vApp.wishlistCourses.splice(index,1);
			}

	}
	
	
}

