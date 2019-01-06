# Courses
| Column Name  	| Type   	|  Description  	|
|:-:	        |---     	|---	            |
| subject	    | text  	| 4 Letter Department identifier.            |
| course_number | text      | The 3 digit course number (101, 202, etc). 	            |
| credits       | integer   | The number of credits to be earned by this course.        |
| name          | text     	| The full name of the course.  	            |
| description   | text      | The paragraph description of the course.  	            |

# Departments
| Column Name  	| Type   	|  Description  	|
|:-:	        |---     	|---	            |
| subject	    | text  	|  4 letter Department identifier. |
| full_name     | text      |  The full name of the department.|

# People
| Column Name  	     | Type   	    |  Description  	|
|:-:	             |---     	    |---	            |
| univeristy_id      | integer   	| 9 digit unique university ID. Primary Key. |
| position           | text         | "Student" or "Faculty" 	                 |
| password           | text         | The hashed and salted password.            |
| first_name         | text      	| The first name of the student.  	         |
| last_name          | text         | The last name of the student.  	         |
| registered_courses | text         | CSV of course registration numbers that this person is assigned. |


# Sections
| Column Name  	     | Type   	    |  Description  	|
|:-:	             |---	        |---            	|
|   crn	             |  integer     |   Course Registration Number. Unique Primary Key.	            |
|   subject          |  text        |   4 Letter Department identifier.	            |
|   course_number	 |  text        |   The 3 digit course number (101, 202, etc). 	            |
|   section_number	 |  text        |   Number identifying the section and additional section modifiers.	            |
|   building	     |  text        |   Building Code.	            |
|   room	         |  text        |   Room code.	            |
|   professor	     |  text        |   Names of the Professors.	            |
|   times	         |  text        |   JSON object containing the times during the week the class is held.            |
|   capacity	     |  integer     |   the number of students allowed to register for the course. 	            |
|   registered	     |  text        |   CSV of student IDs that are registered for this course.	            |