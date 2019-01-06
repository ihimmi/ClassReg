
var fs     = require('fs');
var path   = require('path');
var https  = require('https');
var url    = require('url'); 
var sqlite = require('sqlite3').verbose();

//list of all departments to loop through for data
var depart = ["ACCT","ACSC","ACST","AERO","AMBA","ARAB","ARHS","ARTH","BCHM","BCOM","BETH","BIOL","BLAW","BUSN","CATH","CHDC","CHEM","CHIN","CIED","CISC","CJUS","CLAS","COAC","COJO","COMM","CPSY","CSIS","CSMA","CTED","DRSW","DSCI","DVDM","DVDT","DVHS","DVLS","DVMT","DVPH","DVPM","DVPT","DVSP","DVSS","DVST","ECMP","ECON","EDCE","EDLD","EDUA","EDUC","EGED","ENGL","ENGR","ENTR","ENVR","ESCI","ETLS","EXSC","FAST","FILM","FINC","FREN","GBEC","GENG","GEOG","GEOL","GERM","GIFT","GMUS","GRED","GREK","GRPE","GRSW","GSPA","HIST","HLTH","HONR","HRDO","IBUS","IDSC","IDSW","IDTH","INAC","INCH","INEC","INEG","INFC","INFR","INGR","INHR","INID","INIM","INJP","INLW","INMC","INMG","INMK","INOP","INPS","INRS","INSP","INST","INTR","IRGA","ITAL","JAPN","JOUR","JPST","LATN","LAWS","LEAD","LGST","LHDT","MATH","MBAC","MBEC","MBEN","MBEX","MBFC","MBFR","MBFS","MBGC","MBGM","MBHC","MBHR","MBIF","MBIM","MBIS","MBLW","MBMG","MBMK","MBNP","MBOP","MBQM","MBSK","MBSP","MBST","MBUN","MBVE","MFGS","MGMP","MGMT","MKTG","MMUS","MSQS","MSRA","MUSC","MUSN","MUSP","MUSR","MUSW","NSCI","ODOC","OPMT","PHED","PHIL","PHYS","PLLD","POLS","PSYC","PUBH","QMCS","READ","REAL","RECE","REDP","RUSS","SABC","SABD","SACS","SAED","SAIM","SAIN","SALS","SAMB","SASE","SASW","SEAM","SEIS","SMEE","SOCI","SOWK","SPAN","SPED","SPGT","SPUG","STAT","STEM","TEGR","THEO","THTR","WMST"];
var term = Object.freeze(	
								{
									"J-Term": 10,
									"Spring": 20,
									"Summer": 30,
									"Fall"  : 40
								}
	)

db_path = path.join(__dirname, 'db', 'ust_courses.sqlite3');
// delete old copy of db if it exists
if (fs.existsSync(db_path)){
	fs.unlinkSync(db_path);
}	
// create and open database connection
let db = new sqlite.Database(db_path, (err) => {
	if (err) {
	  console.error(err.message);
	}
	else {
		console.log('Connected to the course_data database.');
		MakeTables();
		GetData(term.Spring, 2019);
		createIndex();
		
	}
  });




/**
 * Creates the tables for the database.
 */
function MakeTables() {
	db.serialize(()=>{
		db.run("CREATE TABLE Departments(subject TEXT PRIMARY KEY, full_name TEXT)");
		db.run("CREATE TABLE Courses(subject TEXT, course_number TEXT, credits INTEGER, name TEXT, description TEXT)");
		db.run("CREATE TABLE Sections(crn INTEGER PRIMARY KEY, subject TEXT, course_number TEXT, section_number TEXT, building TEXT, room TEXT, professors TEXT, times TEXT, capacity INTEGER, registered TEXT)");
		db.run("CREATE TABLE People(university_id INTEGER PRIMARY KEY, position TEXT, password TEXT, first_name TEXT, last_name TEXT, registered_courses TEXT)");
	});
}

/**
 * Indexes created for common SQL searches, each table can have multiple indexes
 */
function createIndex(){
	db.serialize(()=>{
		db.run("CREATE INDEX first_index ON Courses(name)");
		db.run("CREATE INDEX second_index ON Sections(crn)");
		db.run("CREATE INDEX third_index ON Sections(course_number)");
		db.run("CREATE UNIQUE INDEX fourth_index ON Departments(subject)");
	})
}
/**
 * Retrieves data from the website, creates the tables, and populates the database with the website data.
 */
function GetData(term, year) {

	//for loop to go through each department 
	for(let i= 0; i < depart.length; i++){
		//var year = 2019;
		//var term = 20;

		//request to St. Thomas URL
		var request =  {
			protocol: "https:",
			hostname: "classes.aws.stthomas.edu",  
			port: 443,
			path: "/index.htm?year="+year+"&term="+term+"&schoolCode=AS&levelCode=ALL&selectedSubjects="+depart[i], 
			agent: false
		};
		
		/*The received info is one large string, so on receiving info we call various functions to parse the string for the info we need
		  Each function just finds the correct class the information is labeled under for each course and returns it in an array*/
		https.get(request, (res) => {
			console.log("fetching data for department: " + depart[i] + " " +i);
			//body will contain the large string returned from the St. Thomas site that needs to be parsed 
			var body = "";
			
			var sectionNumArr   = []; //Contains only section numbers
			var courseNumArr    = []; //Contains both course and section numbers, DO NOT need to add to database
			var profArr         = []; //Contains Professor Names
			var courseNameArr   = []; //Containes Course Names
			var buildArr        = []; //Contains an array of objects with building and room number keys
			var capArr          = []; //Contains capacity of classes
			var crnArr          = []; //Contains CRN of classes
			var creditArr       = []; //Contains credits of classes
			var courseDescrip   = []; //Contains decription of classes
			var timeArr         = []; //Contains day/time of classes
			var subjectCode     = ""; //Contains four letter subject code for the loaded page, will need to add to each line item
			var fullSubjectName = ""; //Contains the full name of the loaded department page, will need to add to each line item
			var courseSecNum    = []; //contains one course number for every individual course offered in a given semester, regardless of number of sections
			
			///special vars for course array
			var onlyCourseNumArr = []; //Contains only course numbers
			var onlyCourseDesc   = [];
			var onlyCourseCred   = [];
			var onlyCourseName   = [];
			
		
			res.on("data", (chunk) =>{
				body += chunk.toString();
			});
			res.on("end", () => {
					var pattern = /(<h3 style="margin-top:1.5rem">).+<\/h3>/g;
					var match = body.match(pattern);

					if(match != null){
						
						//Once receive data call each function
						var i; 
						profArr= getProf(body);
						courseNumArr    = getCourseNum  (body);
						courseNameArr   = getCourseName (body);
						buildArr        = getBuild      (body);
						capArr          = getCapacity   (body);
						crnArr          = getCRN        (body);
						creditArr       = getCredits    (body);
						courseDescrip   = getDescrip    (body);
						timeArr         = getTime       (body);
						subjectCode     = getSubject    (body);
						fullSubjectName = getSubjectName(body);
						buildArr        = getBuild      (body,subjectCode);

				
						//to split out section and course number from courseNumArr
						for(let x= 0; x < courseNumArr.length; x++){
								 var courseNum = courseNumArr[x];
								 var split = courseNum.split("-");
								 var unique = split[0];
								 if(unique != onlyCourseNumArr[onlyCourseNumArr.length - 1]){
									onlyCourseNumArr.push(split[0]);
									onlyCourseDesc.push(courseDescrip[x]);
									onlyCourseCred.push(creditArr[x]);
									onlyCourseName.push(courseNameArr[x]);
								 }
								 courseSecNum.push(split[0]);
								 sectionNumArr.push(split[1]);
								 
						}
						
			
						///////////////////////////////////////////
						//            Insert statements          //

						//Insert statements for departments
						db.serialize(()=>{
							
							db.prepare("INSERT INTO Departments(subject, full_name) VALUES (?,?);")
							  .bind([subjectCode, fullSubjectName])
							  .run((err)=>{
									if(err){
										console.log(err);
									}else{
										console.log("completed insert into department for " + fullSubjectName);
									}	
							});
							
							//Insert statements for courses
							for(let j=0; j<onlyCourseNumArr.length; j++){
							
								db.prepare("INSERT INTO Courses(subject, course_number, credits, name, description) VALUES(?,?,?,?,?)")
								  .bind(
										[
											subjectCode,
											onlyCourseNumArr[j],
											onlyCourseCred[j],
											onlyCourseName[j],
											onlyCourseDesc[j].replace(/'/g, "\\'")
										]
								    )
								.run((err)=>{
									if(err){
										console.log(err);
										
									}else{
										console.log("completed insert into course for "+ subjectCode + " " + onlyCourseNumArr[j]);
									}
									
								});
								
							}
							
							//insert statements for Sections
							var registered = null;
							var time = "time";
							for(let k=0; k<crnArr.length; k++){
								
								db.prepare("INSERT INTO Sections(crn, subject, course_number, section_number, building, room, professors, times, capacity, registered) VALUES (?,?,?,?,?,?,?,?,?,?);")
								.bind(  
										[
											crnArr[k],
											subjectCode,
											courseSecNum[k],
											sectionNumArr[k],
											buildArr[k].build,
											buildArr[k].room,
											profArr[k],
											JSON.stringify(timeArr[k]),
											capArr[k],
											registered
										]
									)
								.run( (err)=>{
									if(err){
										console.log(err);
									}else{
										//console.log("completed insert into section for " + subjectCode + " " + courseSecNum[k] + "-" + sectionNumArr[k]);
									}
								});
							}
						});
						///////////////////////////////////////////
						
					
						
							
					} //if(match!= null)
			}); //res.on end

		}); //https.get
	} //end of for loop	
	
}

//returns array of professors 
function getProf(str){
	var profArray =[];
	var i;
	for (i= 0; i < str.length ; i++){
				if(str[i] === 's' && str[i+6] === '3' && str[i+8] === 'm' && str[i+15] === '2' && str[i+23] === '2'){
					
					var pos = 26; 
					var testString = '';
					
					while(str[i+pos] !== '<'){
						if(str[i+pos] !== '\t' && str[i+pos] !== '\n'){
							testString += str[i+pos];
						}
						pos++;					
					}
					
					testString = testString.trim();
					
					if(testString !== ''){
						profArray.push(testString);		
					}
					
					else{
						profArray.push(null);
					}
				}		
	};
	
	return profArray;
	
}

//returns array of course and section numbers 
function getCourseNum(str){
	
	var courseNumArr = [];
	
		for (i= 0; i < str.length ; i++){
			if(str[i] === '>'){
				
				if(isNaN(str[i+1]) === false && isNaN(str[i+2]) === false && isNaN(str[i+3]) === false && str[i+4] === '-'){
					var pos = 1; 
					var testString = '';
					
					while(str[i+pos] !== '<'){
						if(str[i+pos] !== '\t' && str[i+pos] !== '\n'){
							testString += str[i+pos];
						}
						pos++;					
					}
					
					testString = testString.trim();
						
					courseNumArr.push(testString);					
				}
				
				else if(isNaN(str[i+1]) === false && isNaN(str[i+2]) === false && isNaN(str[i+3]) === false && str[i+5] === '-'){
						var pos = 1; 
					var testString = '';
					
					while(str[i+pos] !== '<'){
						if(str[i+pos] !== '\t' && str[i+pos] !== '\n'){
							testString += str[i+pos];
						}
						pos++;					
					}
					
					testString = testString.trim();
						
					courseNumArr.push(testString);
					
				}
				
			}
		
		};
	
	
	return courseNumArr;
}

//return array of course names
function getCourseName(str){
		var courseNameArr = [];
	
		var i;
		for (i= 0; i < str.length ; i++){
			if(str[i] === 's' && str[i+6] === '6' && str[i+8] === 'm' && str[i+15] === '4' && str[i+23] === '4'){
					
				var pos = 26; 
				var testString = '';
					
				while(str[i+pos] !== '<'){
					if(str[i+pos] !== '\t' && str[i+pos] !== '\n'){
						testString += str[i+pos];
					}
						pos++;					
				}
					
				testString = testString.trim();
						
				courseNameArr.push(testString);		
			}		
		};
	
	
	return courseNameArr;	
}

//returns an array of objects building name and room number 
function getBuild(str, subjectCode){
	
	var buildArr = [];
		var i;
		
		for (i= 0; i < str.length ; i++){
			if(str[i] === 'l' && str[i+1] === 'o' && str[i+2] === 'c' && str[i+3] === 'a' && str[i+4] === 't' && str[i+5] === 'i' && str[i+6] === 'o' && str[i+7] === 'n' && str[i+8] === 'H' && str[i+9] === 'o'){
				
				
				var pos = i; 
				var building = "";
				var roomNumber = "";
				var lowerLevel = false;
				
				while(str[pos] !== '>'){
					pos++;
				}
				
				pos++;
				
				var check = pos;
				var stringCheck = '';
				while(str[check] !== '<'){
					if(str[check] !== '\n' && str[check] !== '\t'){
						stringCheck += str[check];
					}
					check++;
				}
				stringCheck = stringCheck.trim();
				
				//One building begins with 55
				if(stringCheck[0] === '5' && stringCheck[1] === '5'){
					var pos2 = pos;
					var fullString = '';
					
					pos2 = pos;
					while(str[pos2] !== '<'){
						if(str[pos2] !== '\n' && str[pos2] !== '\t'){
							fullString += str[pos2];
						}
						pos2++;
					}
					
					fullString = fullString.trim();
					building += fullString[0] + fullString[1] + fullString[2];
					
					if(fullString.length > 4){
						var q;
						for(q = 4; q < fullString.length; q++){
							roomNumber += fullString[q];
						}
					}
							
				}
				
				else{
				
					//Test to see if room number contains LL
					
					while(str[pos] !== '<'){
						if(str[pos] === 'L' && str[pos+1] === 'L' && isNaN(str[pos+2]) === false){
							lowerLevel = true;
						}
						
						pos++;
					}
					
					//If a room number contains LL, first check if multiple rooms then parse out room and building 
					if(lowerLevel === true){
						pos = i;
						
						//Check for multiple rooms
						var isComma = false;
						while(str[pos] !== '>'){
							pos++;
						}
						pos++;
						
						
						while(str[pos] !== '<'){
							if(str[pos] === ','){
								isComma = true;
							}
							pos++;
						}
						
						if(isComma === true){
							pos = i;
							while(str[pos] !== '>'){
								pos++;
							}
							pos++;
							
							while(building.length < 3){
								if(str[pos] !== '\n' && str[pos] !== '\t' && str[pos] !== " "){
									building += str[pos];
								}
								pos++;
							}
							while(str[pos] !== ','){
								if(str[pos] !== '\n' && str[pos] !== '\t' && str[pos] !== " "){
									roomNumber += str[pos];
								}
								pos++;
							}
							
							roomNumber += ',';
							
							while(building.length < 7){
								if(str[pos] !== '\n' && str[pos] !== '\t' && str[pos] !== " "){
									building += str[pos];
								}
								pos++;
							}
							
							while(str[pos] !== '<'){
								if(str[pos] !== '\n' && str[pos] !== '\t' && str[pos] !== " "){
									roomNumber += str[pos];
								}
								pos++;
							}
							
							
						}
						
						if(isComma === false){
							
							pos = i;
							while(str[pos] !== '>'){
								pos++;
							}
							
							pos++;
						
							while(str[pos] !== '<'){
								if(building.length < 3 && str[pos] !== '\n' && str[pos] !== '\t' && str[pos] !== " "){
									building += str[pos];
								}
								
								else if(building.length >= 3 && str[pos] !== '\n' && str[pos] !== '\t' && str[pos] !== " "){
									roomNumber += str[pos];	
								}
								pos++;	
							}
						}
						
					} //if(lowerLevel === true)
						
					//If a room number does not contain LL
					if(lowerLevel === false){
						pos =i;
						while(str[pos] !== '>'){
							pos++;
						}
						
						pos++;
							
						while(str[pos] !== '<'){
							if(str[pos] !== '\n' && str[pos] !== '\t' && str[pos] !== " "){
								if(isNaN(str[pos]) === false || str[pos] === ','){
										roomNumber += str[pos];
									}
									
								if(isNaN(str[pos]) === true || str[pos] === ','){
										if(isNaN(str[pos-1]) === false && str[pos] === 'A' && str[pos+1] !== 'R' && building.length > 1){
											roomNumber += str[pos];
										}
										else{
											building += str[pos];
										}
									}
									
							}
							pos++;
						} //while(str[pos] !== '<')
					} //if(lowerLevel === false)
				
				} //else
				
				building = building.trim();

				if(roomNumber.length == 0){
					roomNumber = null;
				}
				
				if(roomNumber !== null){
					roomNumber = roomNumber.trim();
					if(roomNumber.length == 4){
						//if half online and half in classroom used to remove unneeded comma seperator
						if(roomNumber[0] === ',' || roomNumber[3] === ','){
							roomNumber = roomNumber.replace(',','');
						}
					}
				}
				
				buildArr.push({build: building, room: roomNumber});
			}				
		}	

	return buildArr;	
	
}

//returns array of capacity sizes
function getCapacity(str){
	
	var capArr = [];
	
		var i;
		for (i= 0; i < str.length ; i++){
			if(str[i] === 'c' && str[i+1] === 'o' && str[i+2] === 'l' && str[i+3] === 'u' && str[i+4] === 'm' && str[i+5] === 'n' && str[i+6] === 's' && str[i+8] === 's' && str[i+9] === 'm' && str[i+14] === '2' && str[i+16] === '>'){
					
				var pos = 17; 
				var testString = '';
				
				while(str[i+pos] !== '<'){
					if(str[i+pos] !== '\t' && isNaN(str[i+pos]) === false && str[i+pos] !== '\n'){
						testString += str[i+pos];
					}
					pos++;					
				}
						
				capArr.push(testString);		
			}		
		};
	
	return capArr;	
	
	
}

//returns an array of CRN numbers
function getCRN(str){
	
	var crnArr = [];
	
		var i;
		for (i= 0; i < str.length ; i++){
			if(str[i] === 'I' && str[i+1] === 'n' && str[i+2] === 'f' && str[i+3] === 'o' && str[i+4] === 'H' && str[i+5] === 'i' && str[i+6] === 'g' && str[i+7] === 'h' && str[i+8] === 'l' && str[i+9] === 'i' && str[i+10] === 'g' && str[i+11] === 'h' && str[i+12] === 't'){
				var pos = 15; 
				var testString = '';
				var crnNum = "";
				while(str[i+pos] !== '<'){
					if(str[i+pos] !== '\t' && str[i+pos]!== '\n'){
						testString += str[i+pos];
						if(isNaN(str[i+pos]) === false){
								crnNum += str[i+pos];
						}
					}
					pos++;					
				}
				testString = testString.trim();
			
				
				if(testString[0] == 'C' && testString[1] == 'R' && testString[2] == 'N' && testString[3] == ":"){
					crnArr.push(crnNum);
				}
			}		
		};
	
	return crnArr;	
	
}

//returns credits of each course 
function getCredits(str){
	
	
	var creditArr = [];
	
		var i;
		for (i= 0; i < str.length ; i++){
			if(str[i] === 'I' && str[i+1] === 'n' && str[i+2] === 'f' && str[i+3] === 'o' && str[i+4] === 'H' && str[i+5] === 'i' && str[i+6] === 'g' && str[i+7] === 'h' && str[i+8] === 'l' && str[i+9] === 'i' && str[i+10] === 'g' && str[i+11] === 'h' && str[i+12] === 't'){
				var pos = 15; 
				var testString = '';
				var creditNum = "";
				while(str[i+pos] !== '<'){
					if(str[i+pos] !== '\t' && str[i+pos]!== '\n'){
						testString += str[i+pos];
						if(isNaN(str[i+pos]) === false || str[i+pos] === '.'){
								creditNum += str[i+pos];
						}
					}
					pos++;					
				}
				testString = testString.trim();
			
				
				if(testString[2] == 'C' && testString[3] == 'r' && testString[4] == 'e' && testString[5] == "d" && testString[6] == "i" && testString[7] == "t"){
					creditArr.push(creditNum);
				}
				
				else if(testString[3] == 'C' && testString[4] == 'r' && testString[5] == 'e' && testString[6] == "d" && testString[7] == "i" && testString[8] == "t"){
					creditArr.push(creditNum);
				}
				
				else if(testString[4] == 'C' && testString[5] == 'r' && testString[6] == 'e' && testString[7] == "d" && testString[8] == "i" && testString[9] == "t"){
					creditArr.push(creditNum);
				}
			}		
		};
	
	return creditArr;	
	
}

//returns an array of course descriptions
function getDescrip(str){
	var descripArr = [];
	
		var i;
		for (i= 0; i < str.length ; i++){
			if(str[i] === 'c' && str[i+1] === 'o' && str[i+2] === 'u' && str[i+3] === 'r' && str[i+4] === 's' && str[i+5] === 'e' && str[i+6] === 'I' && str[i+7] === 'n' && str[i+8] === 'f' && str[i+9] === 'o' && str[i+10]== '"'){
				var pos = 12; 
				var testString = '';
				while(str[i+pos] !== '<' && str[i+pos+3] !== '>'){
					//Solved error when loading description data by removing quotations
					if(str[i+pos] !== '\t' && str[i+pos]!== '\n' /*&& str[i+pos] !== '"' && str[i+pos] !== "'"*/){
					
						testString += str[i+pos];
						
					}
					pos++;					
				}
				testString = testString.trim();
				
				
			
				descripArr.push(testString);
				
				
			}		
		};
	
	return descripArr;	

}

//returns the four letter subject code of the current page being parsed 
function getSubject(str){
	var subjectString = "";
	var pattern = /(<h3 style="margin-top:1.5rem">).+<\/h3>/g;
	var match = str.match(pattern);
	if(match != null){
		var fullSubject = match[0];
		var i;
		var flag = true;
		for(i=0; i<fullSubject.length;i++){
			//console.log(fullSubject[i]);
			if(fullSubject[i] == '>' && flag==true){
				subjectString = fullSubject.substring((i+1),(i+5));
				flag=false;
			}
			
		}
	}
	return subjectString;
}

/**
 * parses the given str for the times of the given class.
 * 
 * @param {string} str 
 * @returns {Array} an array of objects that contain the class times for each class. Each object will have fields for every day of week ("M", "T", "W", etc) whose value contains the HTML string from the website or the string "null". If no matches are found in the string, it returns an empty array if no matches were found. 
 */
function getTime(str){
	//parse the string with regex
	//var pattern = /(<td class="time">[0-9]+:[0-9]+ (am|pm)<br>[0-9]+:[0-9]+ (am|pm))|(<td class="noTime">(&nbsp))/g;
	//var pattern = new RegExp(/<td class="time">.+<\/td>|(<td class="noTime">(&nbsp))(\/td)/g);
	var pattern = new RegExp(/<td class="time">.+<\/td>|(<td class="noTime">&nbsp.+)(\/td)/g);
	
	var result = str.match(pattern);
	time = []

	// if there were matches
	if(Array.isArray(result)){
		var timePattern = /(?<=\<td class=\"time\"\>)(.*?)(?=\<\/td\>)/g;

		//for every class (i = starting index of each new course)
		for(let i = 0; i < result.length; i= i + 7){

			var timeObj = {};
			//for every day of the week in the course
			for(let j = i; j < i+7; j++){
				
				//if there is a time pattern
				if(timePattern.test(result[j])){
					//add it to the object
					//console.log("timePattern " + result[j].match(timePattern)[0]); 
					timeObj[getDayNumber(j)] = result[j].match(timePattern)[0];
				}else{
					timeObj[getDayNumber(j)] = null;
				}

			}
			//push the object to the array
			time.push(timeObj);
		}

		return time;
	//if no matches return an empty array.
	}else{
		return [];
	}

}

/**
 * returns the letter code of the day of the week based on the given number.
 * @param {number} i the number of the array 
 * @returns {string} the letter code of the day of the week.
 */
function getDayNumber(i){
	result = "";

	if(i % 7 == 0){
		result = "M";
	}else if(i % 7 == 1){
		result = "T";
	}else if(i % 7 == 2){
		result = "W";
	}else if(i % 7 == 3){
		result = "R";
	}else if(i % 7 == 4){
		result = "F";
	}else if(i % 7 == 5){
		result = "SA";
	}else if(i % 7 == 6){
		result = "SU";
	}


	return result;
}


function getSubjectName(str){
	var pattern = /(<h3 style="margin-top:1.5rem">).+<\/h3>/g;
	var match = str.match(pattern);
	//console.log(match);
	if(match != null){
		var fullSubject = match[0];
		var subjectName = "";
		var i;
		for(i=0; i<fullSubject.length;i++){
			//console.log(fullSubject[i]);
			if(fullSubject[i-15] == ':'){
				var j = i;
				while(fullSubject[j]!='<'){
					subjectName += fullSubject[j];
					j++;
				}
				break;
			}
		}
		//console.log(subjectCode);
	}
	return subjectName;
}