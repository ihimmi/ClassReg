var fs = require('fs');
var http = require('http');
var url = require('url'); 
var path = require('path');
var express = require('express'); 
var sqlite3 = require('sqlite3');
var multiparty = require('multiparty');
var app = express(); 
var mime = require('mime-types');


var port = 8014;
var public_dir = path.join(__dirname, 'public'); 

//Used for websockets 
var server = require('http').Server(app);  
var io = require('socket.io')(server);

//Connection to our database
var ust_db = new sqlite3.Database(path.join(__dirname, 'db', 'ust_courses.sqlite3'), (err) => {
	if (err) {
		console.log('Error UST database'); 
	}
	else {
		console.log('Now connected to UST database!');
	}
});


//Any static files that do not come to home (javascript, css) will look to see if file exists 
app.use(express.static(public_dir));

//When a get request occurs to home page displays all homepage info
app.get('/home', (req, res) => {
	
    	fs.readFile(path.join(public_dir, 'index.html'), (err, data) => { 
			if(err){
				res.writeHead(404, {'Content-Type': 'text/plain'});
				res.write('Oh no! Couldn\'t find that page!'); 
				res.end();
			} 
			
			else{
				var mime_type= mime.lookup('index.html') || 'text/plain'; 
				res.writeHead(200, {'Content-Type': mime_type}); 
				res.write(data); 
				res.end();
			} 
		}); 
   
});

//In index when user clicks login will send here
app.post('/login' , (req, res) => {
	var login = 0;
	var pass = '';
	
	var form = new multiparty.Form();
    form.parse(req, (err, fields, files) => {
		
		login = fields.login;
		pass = fields.passwd;
		
		//If login is empty or not a number 
		if(login == '' || pass == ''|| isNaN(login)===true){
			backHome(res,"Please enter a valid login and password", 'orange');
		}
		else{
			ust_db.all("Select * From People where university_id == ?",login, (err, rows) => {
				if (err) {
					console.log('Error running query');
				}
				else {
					//If user tries to login but no username exists
					if(rows.length === 0){
						backHome(res,"Username does not exist! Please create new user",'orange');
					}
					//If user tries to login and user name exists
					else{
						
						if(pass == rows[0].password){
							//Call to our search page if login and password match 
							callSearch(res,login);
							
						} 
						
						//If password and login do not match return to login page and add banner  
						else{
							backHome(res,"Login and password do not match!",'orange');
						}
							
					}//else
				}//else
			}); //ust_db.all
		} //else
		

	}); //form.parse

}); //app.post(/login)

//When user creates a new user through the submit new user button
app.post('/new', (req, res) => {
	
	var login = '';
	var pass = '';
	var position = '';
	var first = '';
	var last = '';
	var isFloat = false
	
	var form = new multiparty.Form();
    form.parse(req, (err, fields, files) => {
		
		login = fields.login;
		
		pass = fields.passwd;
		position = fields.position;
		first = fields.firstName;
		last = fields.lastName;
		//If user enters floating point as login returns true
		isFloat = testFloat(login[0]);
		
		//If any fields are empty or login is not a number 
		if(login == '' || pass == '' || isNaN(login)===true || isFloat === true || first == '' || last == ''){
			backHome(res,"Please enter enter valid values in all fields",'orange');
		}
		else{
			ust_db.all("Select * From People where university_id == ?",login, (err, rows) => {
				if (err) {
					console.log('Error running query');
				}
				else {	
					if(rows.length === 0){
						//If no user previously exists insert data and send user back to home page to log in
						ust_db.run("INSERT INTO People(university_id, position, password, first_name, last_name) VALUES("+login+",\""+position+"\",\""+pass+"\",\""+first+"\",\""+last+"\")");
						
						backHome(res, "Successful creation, please log in!", 'green');
						
					}
					else{
						//If user already exists send back to login page and notify with banner 
						backHome(res,"Cannot create user with existing login!", 'orange'); 
						
					}//else
				}//else
			}); //ust_db.all
		} //else
		

		
	}); //form.parse
	

}); //app.post(/new);

 
//When a user logs in and the search button is clicked, a post request is sent here
//Database selects all information from both the Courses and Sections tables and sends the JSON object back to the browser
app.post('/search/:nconst', (req, res) => {
	
	//1. Parse the subjects sent in the url and place them in subs array
	var urlSubs = req.params.nconst
	var subs = [];
	var courseNumReq = '';
	var crnReq = '';
	subs = urlSubs.split("-");
	
	/*2. If user also searched with crn number or course number will be added to end of url separated by +
		 Parse the last position in the subs array to get the course number and/or crn number */
	var checkSearch =[];
	checkSearch = subs[subs.length-1].split("+");
	
	subs[subs.length-1] = checkSearch[0];
	
	if(checkSearch.length > 1){
		courseNumReq = checkSearch[1];
		crnReq = checkSearch[2];
	}
	
	
	//3. Place all the subjects in the subs array into the proper format to be handled for the SQL statement
	var subsForSQL = '';
	var ind;
	for(ind=0; ind < subs.length; ind++){
		if(ind === 0){
			subsForSQL += "(";
			subsForSQL += "'";
			subsForSQL += subs[ind];
			subsForSQL += "'";
			
		}
		else{
			subsForSQL += ",";
			subsForSQL += "'";
			subsForSQL += subs[ind];
			subsForSQL += "'";
			
		}
	}
	
	//4. If no crn number or course number is searched, call searchNoText function
	if(crnReq == '' && courseNumReq == ''){
		 searchNoText(res,subsForSQL);
		
	}
	
	//5. If a crn or course number is added to the search, call searchWithText function 
	else{
		//Test to make sure searches in box are valid integers for the SQL query if not send back to user to notify
		var pass = true;
		if(crnReq !== ''){
			var test = isNaN(crnReq);
			//console.log(test);
			if(test == true){
				pass = false;
			}
		}
		
		if(courseNumReq !== ''){
			var test2 = isNaN(courseNumReq);
			//console.log('CourseNum: ' +test2);
			if(test2 == true){
				pass = false;
			}
		}
		
		if(pass === true){
			searchWithText(res,subsForSQL,crnReq,courseNumReq);
		}
		else{
			res.send('Bad')
		}
			
		
		//searchWithText(res,subsForSQL,crnReq,courseNumReq);

	}
	
	
});

//Called when faculty selects the view roster button
app.post('/roster/:rconst', (req, res) => {
	//rconst is the crn of the section roster the faculty wishes to view
	var crn = req.params.rconst;
	crn = parseInt(crn);
	
	//1. Grab the list of all university id's registered in the section
	ust_db.all("SELECT Sections.registered FROM Sections WHERE crn == ?",crn, (err, rows) => {
		//List of registered student ids
		var reg = '';
		if (err) {
			console.log('Error running query');
		}
		else {	
			reg = rows[0].registered;
			reg = '(' + reg + ')';
			
			//For each university id registered, grab their first and last name, and send all information back to client side 
			ust_db.all("SELECT People.university_id, People.first_name, People.last_name FROM People WHERE university_id IN"+reg, (err, rows2) => {
				
				res.send(rows2);
				
			}) //ust_db.all(Select People.university_id)
		}
		
	}) //ust_db.all Select 	

}) //app.post(/roster/:rconst)

//This post to the server is called when a student clicks on the register course button
app.post('/register/:rconst', (req, res) => {
	//True if user has previously registered for a specific course, otherwise false
	var isPreviousReg = '';
	//Stores the previous string of comma separated student ids registered
	var previous = '';
	//The login of the user attempting to register
	var login = '';
	//The section CRN the student is attempting to register for 
	var course_reg = '';
	//Components contains a string of login and crn separated with a +
	var components = req.params.rconst;
	
	//Split out and store the login and CRN information
	components = components.split('+');
	login = components[0];
	course_reg = parseInt(components[1]);

	//First grab the students database file from the People table 
	ust_db.all("Select People.registered_courses From People where university_id == ?",login, (err, rows1) => {
		
		//Call function previousReg and determine if the student has already registered for this course 
		isPreviousReg = previousReg(rows1[0].registered_courses, course_reg);
		
		//Only if the student has not previously registered for the course 
		if(isPreviousReg === false){
			//Grab the registered list of student ids and capacity of the class for the course to be registered for 
			ust_db.all("Select Sections.registered, Sections.capacity From Sections where crn == ?",course_reg, (err, rows) => {
						var capacity = rows[0].capacity;
						var toBeWaitlisted = false;	
						//Call isWaitlist to determine if the student should be added to the waitlist for the course 
						toBeWaitlisted = isWaitlist(rows[0].registered, capacity)
						
						if (err) {
							console.log('Error running query');
						}
						
						else {	
							//If no other student has previously registered for this course 
							if(rows[0].registered === null){
								ust_db.run("UPDATE Sections SET registered = \""+login+"\" WHERE Sections.crn == ?", course_reg, (err, rows) => {
											if (err) {
												console.log('Error running query');
											}
											else {	
												if(toBeWaitlisted === false){
													res.send('R');
												}
												else if(toBeWaitlisted === true){
														res.send('W');
												}
											}
								})
							}
							//If other students have registered for this course, grab the previous registered list and add our current id
							else{
								previous = rows[0].registered;
								
								previous += ',' + login;
								
								ust_db.run("UPDATE Sections SET registered = \""+previous+"\" WHERE Sections.crn == ?", course_reg, (err, rows) => {
											if (err) {
												console.log('Error running query');
											}
											else {	
												if(toBeWaitlisted === false){
													res.send('R');
												}
												else if(toBeWaitlisted === true){
														res.send('W');
												}
											}
								});
								
							}//else
							
							//Finally call the insertCRN function to insert the CRN of the course being registered in the registered_courses field for the student in the People table
							insertCRN(login,course_reg,toBeWaitlisted);
							
						}//else
					}); //ust_db.all Select Sections.registered
		} //if(PreviousReg)
		else{
			
			res.send('Error already registered');
			
		}
	}); //ust_db.all Select People.registered_courses
}); //app.post('/register/:rconst')

//App.post(drop) is a post request called when a student selects the drop button for a previously registered course 
app.post('/drop/:dconst', (req, res) => {
	
	//Variable if there is more than one person registered for a course 
	var moreThanOne = false;
	//The login of the user attempting to drop
	var login = '';
	//The section CRN the student is dropping
	var course_drop = '';
	//Components contains a string of login and crn separated with a +
	var components = req.params.dconst;
	
	//Split out and store the login and CRN information
	components = components.split('+');
	login = components[0];
	course_drop = parseInt(components[1]);
	
	//1. Obtain the capacity and students ids registered for the course being dropped 
	ust_db.all("Select Sections.registered, Sections.capacity From Sections where crn == ?",course_drop, (err, rows) => {
		//If there is a waitlist nextRegNum will contain the first number on the waitlist, false if no waitlist 
		var nextRegNum = false;
		//An array of student ids registered for the course 
		var checkNextReg = [];
		//The capacity of the course 
		var cap;
	
		cap = rows[0].capacity;
		
		console.log("Capacity: "+cap);
		
		checkNextReg = rows[0].registered.split(',');
		
		var position = checkNextReg.indexOf(login);
		
		//If only one person registered for course and they drop, moreThanOne will be false in order to set Sections.registered in database to null
		if(checkNextReg.length > 1){
			moreThanOne = true;
		}
		
		//If the amount of registered students exceeds the capacity nextRegNum is equal to the first id on the waitlist 
		if(checkNextReg.length > cap){
			nextRegNum = checkNextReg[cap];
			console.log("Next Reg Num: "+nextRegNum);
		}
		//If there is no waitlist then no need to worry about a waitlister becoming registered 
		if(nextRegNum === false){
			removeFromSections(checkNextReg,login,course_drop,moreThanOne);
			removePeopleOne(login,course_drop,'nullR',res);
		}
		//if the person dropping is the first person on the waitlist then no need to worry about a waitlister becoming registered 
		else if(nextRegNum === login){
			removeFromSections(checkNextReg,login,course_drop,moreThanOne);
			removePeopleOne(login,course_drop,'nullW',res);
		
		}
		//Otherwise we will need to test to see if a waitlister needs to become registered with removePeopleTwo
		else{
			console.log('here in dssd');
			removeFromSections(checkNextReg,login,course_drop,moreThanOne);
			removePeopleTwo(login,course_drop,nextRegNum, res);
			
		}
		
	
	}); //ust_db.all(Select Sections)
	
	
})//app.post(/drop)


//Get request is executed after login in to store the users personal database information
app.get('/position/:pconst', (req, res) => {
	var login = req.params.pconst
	
	ust_db.all("SELECT * FROM People WHERE university_id == ?",login, (err, rows) => {	
		if (err) {
			console.log('Error running query');
		}
		else {
			if(rows[0].registered_courses !== null){
				var x = rows[0].registered_courses.split(",");
				var cleanCourses = [];
				var i;
				for(i=0;i<x.length;i++){
					cleanCourses.push(parseInt(x[i].replace('W','')));
				}
				console.log(cleanCourses);
				var sql_courses = "Sections.crn == " + cleanCourses.join(" OR Sections.crn == ");
				ust_db.all("SELECT Sections.crn, Sections.times, Sections.subject, Sections.course_number, Courses.name FROM Sections INNER JOIN Courses ON Sections.subject = Courses.subject AND Sections.course_number = Courses.course_number WHERE " + sql_courses, (err, rows2) => {
					if(err){
					}
					else{
						var i, j;
						for(i=0;i<rows2.length;i++){
							for(j=0;j<cleanCourses.length;j++){
								if(cleanCourses[j] == parseInt(rows2[i].crn)){
									rows2[i].crn = x[j];
								}
							}
						}
						res.send({courses: rows2, position: rows[0].position});
					}
				});
			}
			else{
				
				res.send(rows[0].position);
			}
		}
	});
});

//Sends all subjects and fullname from department table to browser for checkboxes
app.get('/depts', (req, res) => {
	ust_db.all("SELECT * FROM Departments ORDER BY Departments.subject", (err, rows) => {	
		if (err) {
			console.log('Error running query');
		}
		else {	
			res.send(rows);
		}
	});
});

//Server listens for requests
/*app.listen(port, () => {
    console.log('Now listening on port ' + port);
});*/

/*Function is used to send users back to login page with banner for either successful creation of a new account
or an error on login/creation of an account*/
function backHome(res,reason,color){
	fs.readFile(path.join(public_dir, 'index.html'), (err, data) => { 
		if(err){
			res.writeHead(404, {'Content-Type': 'text/plain'});
			res.write('Oh no! Could\'t find that page!'); 
			res.end();
		}  
		
		else{
			var mime_type= mime.lookup('index.html') || 'text/html'; 
			res.writeHead(200, {'Content-Type': mime_type});
			
			//Banner that displays to the user what is incorrect with their login or successful creation of a new account 
			res.write('<h3 style= "color: white; background-color: '+color+'; text-align: center;">'+reason+'</h3>');
			res.write(data); 
			res.end();
		} 
	}); //fs.readFile 
	

}

//Function is used to send users to our search page on successful login
function callSearch(res,log){
	
	fs.readFile(path.join(public_dir, 'search.html'), (err, data) => { 
		if(err){
			res.writeHead(404, {'Content-Type': 'text/plain'});
			res.write('Oh no! Could\'t find that page!'); 
			res.end();
		} 
		
		else{
			var mime_type= mime.lookup('search.html') || 'text/html'; 
			res.writeHead(200, {'Content-Type': mime_type}); 
			//Added the user login name in order to store it for later querying in the searchJava page
			res.write("<p id = 'user'> Welcome User: " +log+ "</p>");
			res.write(data); 
			res.end();
		} 
	});
	
}

//Tests to see if user entered floating point number as login 
function testFloat(login){
	var i;
	for(i=0; i < login.length;i++){
		if(login[i] == '.'){
			return true;
			
		}
	}
	
	return false;
}

//searchNoText function is used to call the SQL database if a user searches based on checkboxes but no crn or course number 
function searchNoText(res,subsForSQL){
	
	var sqlString = "SELECT  Sections.subject, Sections.course_number, Sections.section_number, Courses.name, Sections.building, Sections.room, Sections.professors, Courses.credits, Sections.crn, Sections.registered, Sections.capacity, Sections.times, Courses.description FROM Sections INNER JOIN Courses ON Sections.course_number=Courses.course_number AND Sections.subject = Courses.subject WHERE Sections.subject IN ";
	
	sqlString += subsForSQL;

	sqlString+= ") ORDER BY Sections.subject, Sections.course_number, sections.section_number";
	//console.log(sqlString);
		
	ust_db.all(sqlString, (err, rows) => {	
			if (err) {
				console.log('Error running query');
			}
			else {
					res.send(rows);
					
			}
		});
	
}

//searchWithText function is used to call the SQL database if a user searches based on checkboxes and a crn and/or course number 
function searchWithText(res,subsForSQL,crnNum,courseNum){

	var isCRN = true;
	var isCourseNum = true;
	
	if(crnNum == undefined){
		isCRN = false;
	}
	//Did a user search a crn 
	if(crnNum !== undefined){
		if(crnNum.length < 1){
			isCRN = false;
		}
	}
	else{
		crnNum = parseInt(crnNum);
	}
	
	//Did a user search a course number 
	if(courseNum.length < 1){
		isCourseNum = false;
	}
	
	//SQL search for only course number 
	if(isCourseNum == true && isCRN == false){
		var sqlString = "SELECT  Sections.subject, Sections.course_number, Sections.section_number, Courses.name, Sections.building, Sections.room, Sections.professors, Courses.credits, Sections.crn, Sections.registered, Sections.capacity, Sections.times, Courses.description FROM Sections INNER JOIN Courses ON Sections.course_number=Courses.course_number AND Sections.subject = Courses.subject WHERE Sections.course_number = \""+courseNum+"\" AND Sections.subject IN ";
	
		sqlString += subsForSQL;
		sqlString+= ") ORDER BY Sections.subject, Sections.course_number, sections.section_number";
		//console.log(sqlString);
			
			ust_db.all(sqlString, (err, rows) => {	
					if (err) {
						console.log('Error running query');
					}
					else {	
							res.send(rows);
					}
				});
			
	}
	
	//SQL search for only CRN
	if(isCourseNum == false && isCRN == true){
		
			var sqlString = "SELECT  Sections.subject, Sections.course_number, Sections.section_number, Courses.name, Sections.building, Sections.room, Sections.professors, Courses.credits, Sections.crn, Sections.registered, Sections.capacity, Sections.times, Courses.description FROM Sections INNER JOIN Courses ON Sections.course_number=Courses.course_number AND Sections.subject = Courses.subject WHERE Sections.crn = "+crnNum+" AND Sections.subject IN ";
	
			sqlString += subsForSQL;
			sqlString+= ")";
			//console.log(sqlString);
				
			ust_db.all(sqlString, (err, rows) => {	
					if (err) {
						console.log('Error running query');
					}
					else {	
							res.send(rows);
					}
				});
		
		
	}
	
	//SQL search for both course number and CRN
	if(isCourseNum == true && isCRN == true){
	
		var sqlString = "SELECT  Sections.subject, Sections.course_number, Sections.section_number, Courses.name, Sections.building, Sections.room, Sections.professors, Courses.credits, Sections.crn, Sections.registered, Sections.capacity, Sections.times, Courses.description FROM Sections INNER JOIN Courses ON Sections.course_number=Courses.course_number AND Sections.subject = Courses.subject WHERE Sections.course_number = \""+courseNum+"\" AND Sections.subject IN ";
		
			sqlString += subsForSQL;
			sqlString+= ") AND Sections.crn = "+crnNum;
			
				ust_db.all(sqlString, (err, rows) => {	
						if (err) {
							console.log('Error running query');
						}
						else {	
								res.send(rows);
						}
					});
			
		
	}
}

//Called by app.post(register), used to check if a student has previously registered for a certain course 
//List is a comma seperated list of all CRNS a student is registered for, curCRN is the current CRN a student is attempting to register for 
//Returns false if not previously registered and true if previously registerd 
function previousReg(list, curCRN){
	var i;
	if(list === null){
		return false;
	}

	list = list.split(',');
	
	for(i=0; i < list.length; i++){
		if(list[i][0] === 'W'){
			list[i] = list[i].slice(1);
		}
		
		if(list[i] == curCRN){
			return true;
		}
	}
	
	return false;

}
//Function isWaitlist takes a list of currently registered student ids for a course and the capacity of a course
//If the students registered for the course is equal to or greater than capacity return true to add the student to the waitlist for the course 
function isWaitlist(regList, capacity){
	if(regList === null){
		return false;
	}
	else{	
		regList = regList.split(',');
		if(regList.length >= capacity){
			return true;
		}
		return false;
	}	
}

/*Function insertCRN is used to insert the CRN of a registered course into the registered_courses field of a students data in the SQL People table
  login is the university_id of the student, course_reg is the Section CRN to be registered for, waitlisted is a boolean representing if a student needs
  to be waitlisted for the course*/
function insertCRN(login, course_reg, waitlisted){
	
	ust_db.all("Select People.registered_courses From People where university_id == ?",login, (err, rows) => {
			if (err) {
				console.log('Error running query');
			}
			else {	
				//If student has not yet registered for any courses
				if(rows[0].registered_courses === null){
					//If student should be waitlisted for the course 
					if(waitlisted === true){
						course_reg = 'W' + course_reg;
						
					}
					
					ust_db.run("UPDATE People SET registered_courses = \""+course_reg+"\" WHERE university_id == ?", login);
				
				}
				else{
					//If user has already registered for courses, grab previous list and add new section CRN 
					previous = rows[0].registered_courses;
					
					if(waitlisted === true){
						course_reg = 'W' + course_reg;
						
					}
					
					previous += ',' + course_reg;
					
					ust_db.run("UPDATE People SET registered_courses = \""+previous+"\" WHERE university_id == ?", login, (err, rows) => {
								if (err) {
									console.log('Error running query');
								}
								else {	
								
								}
					});
					
				}//else
				
				
			}//else
	}); //ust_db.all Select Sections.registered
	
} //function insertCRN

//Remove from sections is called from the drop button post request and is used to remove the dropped students user id from the sections table registered column
function removeFromSections(list,login,crn,moreThanOne){
		var forSQL = '';
	
		//If there was only one student and they dropped, set registered to null
		if(moreThanOne === false){
			ust_db.run("UPDATE Sections SET registered=null WHERE Sections.crn == ?", crn, (err, rows) => {
						if (err) {
							console.log('Error running query');
						}
						else {	
							
						}
			});
		}
		
		if(moreThanOne === true){
			var i;
			
			//Remove the student's user id who is dropping from the current list of registered students 
			for(i =0; i < list.length; i++){
				if(login == list[i]){
					list.splice(i,1);
				}
			}
			//Rebuild the string based on current array list 
			for(i = 0; i < list.length; i++){
				forSQL += list[i];
				if(i !== list.length-1){
					forSQL += ',';
				}
				
			}
			
			//Update the table for the new listing 
			ust_db.run("UPDATE Sections SET registered= \""+forSQL+"\" WHERE Sections.crn == ?", crn, (err, rows) => {
						if (err) {
							console.log('Error running query');
						}
						else {	
							
						}
			});
		}
	
}//function removeFromSections 

//Function removePeopleOne is used to remove the CRN from the registered_courses listing of the student dropping 
function removePeopleOne(login,course_drop,nextRegNum,res){
	console.log('here');
	//An array of the students currently registered CRNS
	var previous = []
	//A string used to insert into SQL
	var forSQL = '';
	
	ust_db.all("Select People.registered_courses From People where university_id == ?",login, (err, rows) => {
			previous = rows[0].registered_courses.split(',');
			
			var i;
			for(i = 0; i < previous.length; i++){
				
				//If the student was on the waitlist for the dropped course
				if(previous[i][0] === 'W'){
					if(course_drop == previous[i].substring(1)){
						previous.splice(i,1);
					}
				}
				//If the student was normally registered for the course 
				else if(course_drop == previous[i]){
						previous.splice(i,1);
				}
				
			}
			//Rebuild the string for SQL
			for(i = 0; i < previous.length; i++){
				forSQL += previous[i];
				if(i !== previous.length-1){
					forSQL += ',';
				}
			}
			//If the student has other registered courses after removing the dropped course 
			if(previous.length !== 0){
				ust_db.run("UPDATE People SET registered_courses= \""+forSQL+"\" WHERE People.university_id == ?", login, (err, rows2) => {
							if (err) {
								console.log('Error running query');
							}
							else {	
								res.send(nextRegNum);
							}
				});
			}
			//If that was the only course the student took and they dropped set registered_courses = null
			else if(previous.length === 0){
				ust_db.run("UPDATE People SET registered_courses=null WHERE People.university_id == ?", login, (err, rows2) => {
							if (err) {
								console.log('Error running query');
							}
							else {	
								res.send(nextRegNum);
							}
				});
					
			}
			
	})//ust_db.all(Select People.registered_courses)
	
}



//Function removePeopleTwo is used to test and resolve if a dropped student causes another student to move off the waitlist 
function removePeopleTwo(login,course_drop,nextRegNum, res){
	//Variable that determines if the two students were both on the waitlist 
	var twoWaitLists = false;
	
	console.log(nextRegNum);
	//Array of the registered courses listing of the student dropping 
	var loginRegisteredCourses = [];
	//Array of the registered courses listing of the student 1st on the waitlist 
	var waitlistRegisteredCourses =[];
	ust_db.all("Select People.registered_courses From People where university_id == \""+login+"\"", (err, rows) => {
		
					loginRegisteredCourses = rows[0].registered_courses.split(',');
					
		ust_db.all("Select People.registered_courses From People where university_id == \""+nextRegNum+"\"", (err, rows2) => {			
					
					
					waitlistRegisteredCourses = rows2[0].registered_courses.split(',');
					
					console.log("Login Registered Courses: "+loginRegisteredCourses);
					console.log("Waitlist Registered Courses: "+waitlistRegisteredCourses);
					
					//If both the person dropping and the student first on the waitlist are on the waitlist then we do not have to do any manipulation to the first person on the waitlist 
					if(loginRegisteredCourses.includes(course_drop.toString()) === false && waitlistRegisteredCourses.includes(course_drop.toString()) === false){
						twoWaitLists = true;
					}
					
					console.log('Two WaitLists: '+twoWaitLists);
					
					if(twoWaitLists === true){	
						removePeopleOne(login,parseInt(course_drop),'nullW',res);
					}
					
					//If a registered student drops and there is a person on the waitlist, move that person on the waitlist to registered 
					if(twoWaitLists === false){
						var forSQL = '';
						
						console.log('NEW CASE');
						
						var i;
						//Remove the W from the registered courses 
						for(i = 0; i < waitlistRegisteredCourses.length; i++){
							if(waitlistRegisteredCourses[i][0] === 'W'){
								
								if(course_drop == waitlistRegisteredCourses[i].substring(1)){
									waitlistRegisteredCourses[i] = waitlistRegisteredCourses[i].substring(1);
								}
							}	
						}
						//Build up new string and call a Update SQL statement 
						for(i = 0; i < waitlistRegisteredCourses.length; i++){
							forSQL += waitlistRegisteredCourses[i];
							if(i !== waitlistRegisteredCourses.length-1){
								forSQL += ',';
							}
						}
						//Updating the database for the waitlisted course that is now registered 
						ust_db.run("UPDATE People SET registered_courses= \""+forSQL+"\" WHERE People.university_id == ?", nextRegNum, (err, rows3) => {
										if (err) {
											console.log('Error running query');
										}
										else {
											//Call removePeopleOne to adjust database for the student actually dropping 
											removePeopleOne(login,course_drop,nextRegNum,res)  
										}
						}); //ust_db.run Update People
					}
					
		})//Select People.registered nextRegNum
	})//Select People.registered login
			
	
}//function removePeopleTwo



//Start of functionality for websockets 

//When a new client connects with the server
io.on('connection', (client) => {
	
	//Add register is sent from a client who clicks the register button and is added to the register count
	client.on('addRegister', (crn) => {
        io.emit('addRegister', crn);
    });
	//Add waitlist is sent from a client who clicks the register button and is added to the waitlist
	client.on('addWaitlist', (crn) => {
        io.emit('addWaitlist', crn);
    });
	//Drop course is send from a client who drops a course, field indicates whether the client dropping was on the register list or waitlist 
	client.on('dropCourse', (crn,field) => {
        io.emit('dropCourse', crn,field); 
    });
	//waitToReg is called when a client is moved from the waitlist to the register list, login represents the users login who is now placed on the register list from the waitlist
	client.on('waitToReg', (crn,login) => {
        io.emit('waitToReg', crn,login); 
    });
	
});


//Server listens for requests replaces app.listen
server.listen(port, () => {
    console.log('Now listening on port ' + port);
});