/*=========================================
        EDUCORE ENROLLMENT JS
=========================================*/


/*=========================================
        PORTAL SWITCH
=========================================*/

function showPortal(portalName){

    const boxes = document.querySelectorAll(".portal-box");

    const buttons = document.querySelectorAll(".portal-btn");


    boxes.forEach(box=>{

        box.classList.remove("active");

    });


    buttons.forEach(btn=>{

        btn.classList.remove("active");

    });



    const selectedBox = document.getElementById(portalName);


    if(selectedBox){

        selectedBox.classList.add("active");

    }


    event.target.closest("button")
    .classList.add("active");

}




/*=========================================
        PHOTO PREVIEW
=========================================*/


const photoInput = document.querySelector(
    'input[type="file"]'
);


if(photoInput){


photoInput.addEventListener("change",function(){


const file=this.files[0];


if(file){


const reader=new FileReader();



reader.onload=function(e){


localStorage.setItem(
"studentPhoto",
e.target.result
);


};


reader.readAsDataURL(file);



}



});


}




/*=========================================
        REGISTRATION SUBMIT
=========================================*/


const registrationForm =
document.querySelector(".registration-form");



if(registrationForm){


registrationForm.addEventListener(
"submit",
function(e){


e.preventDefault();



const name =
document.querySelector(
".input-box input[type='text']"
).value;



const course =
document.querySelector(
"select"
).value;



if(name===""){

alert("Please Enter Name");

return;

}



const studentID =
"EC"+Math.floor(Math.random()*999999);



const password =
studentID.slice(-6);



const student={

name:name,

course:course,

id:studentID,

password:password


};



localStorage.setItem(
"studentData",
JSON.stringify(student)
);



updateCard(student);



alert(
"Registration Successful\n\nStudent ID : "
+studentID+
"\nPassword : "
+password
);



document.querySelector(
"#idcard"
).scrollIntoView({

behavior:"smooth"

});



});


}





/*=========================================
        UPDATE ID CARD
=========================================*/


function updateCard(student){



const name =
document.querySelector(
".id-body h3"
);


const details =
document.querySelectorAll(
".id-body p"
);



if(name){

name.innerText =
student.name;

}



if(details.length>=2){


details[0].innerText =
"Student ID : "+student.id;


details[1].innerText =
"Course : "+student.course;


}




const photo =
localStorage.getItem(
"studentPhoto"
);



if(photo){


const img =
document.querySelector(
".student-photo"
);


if(img){

img.src=photo;

}


}



}





/*=========================================
        LOAD DATA
=========================================*/


window.onload=function(){


const saved =
JSON.parse(
localStorage.getItem("studentData")
);



if(saved){

updateCard(saved);

}



};





/*=========================================
        ID CARD DOWNLOAD
=========================================*/


const download =
document.querySelector(
".download-btn"
);



if(download){



download.onclick=function(){



const card =
document.querySelector(
".id-card"
);



html2canvas(card)
.then(canvas=>{


const link =
document.createElement("a");


link.download =
"EduCore-ID-Card.png";


link.href =
canvas.toDataURL();


link.click();



});



};



}