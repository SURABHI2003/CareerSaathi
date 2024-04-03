import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import { createTransport } from "nodemailer";
//import emailjs from 'emailjs-com';

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "careersaathi",
  password: "surabhi",
  port: 5432,
});

//emailjs.init("btbti20138_surabhi@banasthali.in");

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentStudentID;
let message = "";
let currentProjectID;
let currentTechStacks;
let currentContributors;
let contributorDetails;
const adminUser = "admin";
const adminPass = "12345";
let companyData;
let currentOTP = 0;
let details;

let mt = createTransport({
    service: "gmail",
    auth: {
        user: "surabhi.22203@gmail.com",
        pass: "qhqn aece dbbr eeto"
    }
})

async function getProjectDetails(p_id) {
    currentProjectID = p_id;

    // Fetch tech stacks and contributors concurrently
    const [techStacksResult, contributorsResult] = await Promise.all([
        db.query("SELECT * FROM tech_stack WHERE p_id = $1", [currentProjectID]),
        db.query("SELECT * FROM contributer WHERE p_id = $1", [currentProjectID])
    ]);

    currentTechStacks = techStacksResult.rows;

    contributorDetails = await Promise.all(contributorsResult.rows.map(async (element) => {
        const studentData = await db.query("SELECT first_name, linkedin FROM student WHERE student_id = $1", [element.c_id]);
        return studentData.rows;
    }));

    contributorDetails = contributorDetails.flat();
}

async function getCompanyData() {
    companyData = (await db.query("SELECT * FROM company")).rows;
}

// async function sendMail() {
//     try {
//         const currentOTP = Math.floor(100000 + Math.random() * 900000);
//         const params = {
//             message: "Your OTP is: " + currentOTP
//         };

//         const serviceId = "service_k5jt0pl";
//         const templateId = "template_2gfgdcn";

//         await emailjs.send(serviceId, templateId, params);
//         console.log("Email sent successfully");
//     } catch (error) {
//         console.error("Error sending email:", error);
//     }
// }

app.get("/", async (req, res) => {
    res.render("identification.ejs");
});

app.post("/student-login", async (req, res) => {
  res.render("login.ejs");
});

app.post("/student-register", async (req, res) => {
    res.render("registration.ejs");
});

app.post("/login", async (req, res) => {
    const n1 = req.body.fullName;
    const id = req.body.studentID;
    const c = req.body.course;
    const cem = req.body.collegeEmail;
    const p = req.body.password;
    const li = req.body.linkedin;
    const contact = req.body.contact;
    const admyr = req.body.adyr;
    const endyr = req.body.grayr;

    try {
        await db.query("INSERT INTO student(student_id, first_name, course, college_email, pswd, linkedin, contact, admission_year, end_year) VALUES (LOWER($1), $2, $3, $4, $5, $6, $7, $8, $9)", [id, n1, c, cem, p, li, contact, admyr, endyr]);
        res.render("login.ejs");
    } catch (error) {
        console.log(error);
        res.render("registration.ejs");
    }
});

app.post("/home", async (req, res) => {
    const id = req.body.id;
    const pass = req.body.password;

    try {
        const data = await db.query("SELECT pswd FROM student WHERE student_id = $1", [id.toLowerCase()]);
        const correct_pswd = data.rows[0].pswd;
        if(pass == correct_pswd) {
            res.render("home.ejs");
            currentStudentID = id.toLowerCase();
            //console.log(correct_pswd);
        }
        else {
            res.render("login.ejs");
        }
    } catch (error) {
        console.log(error);
        res.render("login.ejs");
    }
});

app.post("/submit-report", async (req, res) => {
    const s = req.body.subject;
    const c = req.body.concern;

    try {
        await db.query("INSERT INTO report(subject, concern, student_id, status) VALUES ($1, $2, $3, $4)", [s, c, currentStudentID, "P"]);
        res.render("report.ejs", { successMessage: "Report submitted successfully!" });
    } catch (error) {
        console.log(error);
        res.render("report.ejs", { errorMessage: "Error submitting report." });
    }
});



app.get("/report", async (req, res) => {
    res.render("report.ejs");
});

app.get("/calendar", async (req, res) => {
    await getCompanyData();
    res.render("company.ejs", {
        companies: companyData,
    });
});

app.get("/show-project", async (req, res) => {
    try {
        const data = await db.query("SELECT * FROM project");

        // Fetch project details for each project
        const projectsWithDetails = [];
        for (const project of data.rows) {
            await getProjectDetails(project.id);

            const projectDetails = {
                ...project,
                techStacks: currentTechStacks,
                contributorDetails: contributorDetails,
            };

            projectsWithDetails.push(projectDetails);
        }

        res.render("show-project.ejs", {
            projects: projectsWithDetails,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});


app.get("/add-project", async (req, res) => {
    res.render("add-project.ejs");
});

app.post("/add-project-details", async (req, res) => {
    const name = req.body.name;
    const dsc = req.body.description;
    const link = req.body.githubLink;
    const c = req.body.contributors;
    const tech = req.body.techStacks;
    const clist = req.body.contributors.split(",");    
    const tlist = tech.split(",");

    let pid = await db.query("INSERT INTO project(name, description, github_link, contributer, tech_stack) VALUES ($1, $2, $3, $4, $5) RETURNING id", [name, dsc, link, c, tech]);
    pid = pid.rows[0].id;
    //console.log("pid = " + pid);

    try {
        clist.forEach(cr => {
            db.query("INSERT INTO contributer(p_id, c_id) VALUES ($1, $2)", [pid, cr.trim().toLowerCase()]);
        });

    } catch (error) {
        console.log(error);
        console.log("Cant insert values to contributer table");
    }

    try {
        tlist.forEach(t => {
            db.query("INSERT INTO tech_stack(name, p_id) VALUES ($1, $2)", [t.trim().toLowerCase(), pid]);
        });
    } catch (error) {
        console.log(error);
        console.log("Cant insert values to tech_stack table");
    }

    res.render("add-project.ejs");
});

app.get("/admin-login", async (req, res) => {
    res.render("admin-login.ejs");
});

app.post("/admin-login", async (req, res) => {
    if(req.body.id == adminUser && req.body.password == adminPass) {
        res.render("home-admin.ejs");
    }
    else {
        res.render("admin-login.ejs");
    }
});

app.get("/manage-company", async (req, res) => {
    await getCompanyData();
    console.log(companyData);
    res.render("company-admin.ejs", {
        companies: companyData,
    });
});

app.get("/add-company", async (req, res) => {
    await getCompanyData();
    console.log(companyData);
    res.render("add-company.ejs", {
        companies: companyData,
    });
});

app.post("/add-company-details", async (req, res) => {
    const n = req.body.name;
    const y = req.body.year;
    const m = req.body.month;
    const i = req.body.info;
    const w = req.body.website;
    const r = req.body.role;

    try {
        await db.query("INSERT INTO company(name, year, month, info, website, role) VALUES ($1, $2, $3, $4, $5, $6)", [n, y, m, i, w, r]);
        await getCompanyData();
        res.render("company-admin.ejs", {
             successMessage: "Details Successfully Submitted!", 
             companies: companyData,
        });
    } catch (error) {
        console.log(error);
        await res.render("add-company.ejs", { errorMessage: "Error Submitting Details!" });
    }
});

app.get("/profile", async (req, res) => {
    const data = (await db.query("SELECT * FROM student WHERE student_id = $1", [currentStudentID])).rows;
    //console.log(currentStudentID);
    console.log(data);
    res.render("profile.ejs", {
        profileDetails: data,
    });
});

app.get("/upgrade", async (req, res) => {
    res.render("upgrade.ejs");
});

app.get("/send-otp", async (req, res) => {
    let generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    let msg = "Your OTP is: " + generatedOtp;
    details = {
        from: "surabhi.22203@gmail.com",
        to: "shreyasurabhi2003@gmail.com",
        subject: "OTP",
        text: msg
    }

    await mt.sendMail(details, (err) => {
        if(err) {
            console.log("It has this error: ", err);
        }
        else {
            console.log("Email sent successfully!");
        }
    })
});

app.post("/submit-otp", async (req, res) => {
    
});

app.get("/generate-resume", async (req, res) => {
    res.render("resume-index.ejs");
});

app.get("/create-resume", async (req, res) => {
    res.render("resume.ejs");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});