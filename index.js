import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import { createTransport } from "nodemailer";
import multer from "multer";
import fs from 'fs';
import * as path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);


const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "careersaathi",
  password: "surabhi",
  port: 5432,
});

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentStudentID;
let message = "";
let currentProjectID;
let currentTechStacks;
let contributorDetails;
const adminUser = "admin";
const adminPass = "12345";
let companyData;
let details;
let generatedOtp;
let isAlumni = false;
let isStudent = true;

let mt = createTransport({
    service: "gmail",
    auth: {
        user: "surabhi.22203@gmail.com",
        pass: "qhqn aece dbbr eeto"
    }
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/') // Save uploaded files to the "uploads" directory
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname) // Keep the original file name
    }
});

const upload = multer({ storage: storage });

async function getCompanyData() {
    companyData = (await db.query("SELECT * FROM company")).rows;
}

app.get("/", async (req, res) => {
    res.render("landing-page.ejs");
});

app.get('/navbar', (req, res) => {
    res.render('navbar.ejs', {
        isAdmin: isAdmin,
        isAlumni: isAlumni,
        isStudent: isStudent,
    });
});

app.get('/navbar-reg', (req, res) => {
    res.render('reg-navbar.ejs', {
        isAdmin: isAdmin,
        isStudent: isStudent,
        isAlumni: isAlumni,
    });
});

app.get('/landing-navbar', (req, res) => {
    res.render('landing-navbar.ejs');
});

app.get('/logout', (req, res) => {
    res.render('landing-page.ejs');
});

app.get('/side', (req, res) => {
    res.render('menu-student.ejs', {
        isAlumni: isAlumni,
        isAdmin: isAdmin,
        isStudent: isStudent,
    });
});

app.get('/landing-login', (req, res) => {
    res.render('identification.ejs');
});


app.post("/student-login", async (req, res) => {
  res.render("login.ejs");
});

app.post("/student-register", async (req, res) => {
    res.render("registration.ejs");
});

app.get("/navigate-student-home", async (req, res) => {
    res.render("home.ejs");
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
            isAlumni = false;
            isAdmin = false;
            isStudent = true;
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

let isAdmin = false;

app.post("/admin-login", async (req, res) => {
    if(req.body.id == adminUser && req.body.password == adminPass) {
        isAdmin = true;
        isStudent = false;
        isAlumni = false;
        res.render("home.ejs", {
            isAdmin : isAdmin,
        });
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
    //console.log(data);
    res.render("profile.ejs", {
        profileDetails: data,
        isStudent: isStudent,
    });
});

app.get("/upgrade", async (req, res) => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const data = (await db.query("SELECT * FROM student WHERE student_id = $1", [currentStudentID]));
    const d1 = data.rows[0];
    const need = d1.end_year;
    const flag = (currentYear >= need);
    
    if (currentYear >= need) { 
        res.render("upgrade.ejs", { successMessage: "You have been upgraded to Alumni!" });
    }
    else {
        res.render("upgrade.ejs", { errorMessage: "Error upgrading profile!" });
        console.log("It's not your passing out year!")
    }
});


app.post("/send-otp", async (req, res) => {
    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    let em = req.body.email;
    console.log(em);
    let msg = "Your OTP is: " + generatedOtp;
    details = {
        from: "surabhi.22203@gmail.com",
        to: em,
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
    console.log(currentStudentID);
    console.log("Right otp: " + generatedOtp);
    console.log("Entered otp: " + req.body.otp);
    console.log(req.body.email);
    if(req.body.otp == generatedOtp) {
        console.log(currentStudentID);
        isAlumni = true;
        isStudent = false;
        await db.query("INSERT INTO alumni(student_id, personal_email) VALUES ($1, $2)", [currentStudentID, req.body.email]);
        message = "Profile succesfully upgraded!"
        res.render("home.ejs");
    }
    else {
        message = "Wrong OTP entered!"
    }
    console.log(message);
});

app.get("/generate-resume", async (req, res) => {
    res.render("resume-index.ejs");
});

app.get("/create-resume", async (req, res) => {
    res.render("resume.ejs");
});

app.get("/alumni-login", async (req, res) => {
    res.render("alumni-login.ejs");
});

app.post("/home-alumni", async (req, res) => {
    const e = req.body.email;
    const data = (await db.query("SELECT student.pswd, student.student_id FROM student INNER JOIN alumni ON student.student_id = alumni.student_id WHERE alumni.personal_email = $1", [e])).rows[0];
    if(data.pswd == req.body.password) {
        currentStudentID = data.student_id;
        isAlumni = true;
        isAdmin = false;
        isStudent = false;
        res.render("home.ejs");
    }
    else {
        res.render("alumni-login.ejs");
    }
});

app.get("/manage-reports", async (req, res) => {
    const reports = (await db.query("SELECT * FROM report WHERE status = $1", ['P'])).rows;
    res.render("manage-report.ejs", {
        reports: reports,
    });
});

app.post("/update-status", async (req, res) => {
    await db.query("UPDATE report SET status = $1 WHERE id = $2", ['R', req.body.id]);
    const reports = (await db.query("SELECT * FROM report WHERE status = $1", ['P'])).rows;
    console.log(reports);
    res.render("manage-report.ejs", {
        reports: reports,
    });
});

app.get("/alumni-connect", async (req, res) => {
    const company_alumni = (await db.query("SELECT s.first_name, s.course, s.end_year, s.linkedin, sc.company FROM alumni a JOIN student s ON a.student_id = s.student_id JOIN student_company sc ON a.student_id = sc.student_id")).rows;
    //console.log(company_alumni);
    res.render("alumni-connect.ejs", {
        alumni: company_alumni,
    });
});

app.post("/filter-alumni", async(req, res) => {
    const desired_company = req.body.company_filter;
    const year = req.body.year_filter;

    if(desired_company && year) {
        const company_alumni = (await db.query("SELECT s.first_name, s.course, s.end_year, s.linkedin, sc.company FROM alumni a JOIN student s ON a.student_id = s.student_id JOIN student_company sc ON a.student_id = sc.student_id WHERE sc.company = $1 AND s.end_year = $2", [desired_company, year])).rows;
        res.render("alumni-connect.ejs", {
            alumni: company_alumni,
        });
    }
    else if(year) {
        const company_alumni = (await db.query("SELECT s.first_name, s.course, s.end_year, s.linkedin, sc.company FROM alumni a JOIN student s ON a.student_id = s.student_id JOIN student_company sc ON a.student_id = sc.student_id WHERE s.end_year = $1", [year])).rows;
        res.render("alumni-connect.ejs", {
            alumni: company_alumni,
        });
    }
    else if(desired_company) {
        const company_alumni = (await db.query("SELECT s.first_name, s.course, s.end_year, s.linkedin, sc.company FROM alumni a JOIN student s ON a.student_id = s.student_id JOIN student_company sc ON a.student_id = sc.student_id WHERE sc.company = $1", [desired_company])).rows;
        res.render("alumni-connect.ejs", {
            alumni: company_alumni,
        });
    }
    else {
        const company_alumni = (await db.query("SELECT s.first_name, s.course, s.end_year, s.linkedin, sc.company FROM alumni a JOIN student s ON a.student_id = s.student_id JOIN student_company sc ON a.student_id = sc.student_id")).rows;
        res.render("alumni-connect.ejs", {
            alumni: company_alumni,
        });
    }
});

app.post('/upload-resource', upload.array('files'), async (req, res) => {
    try {
        const role = req.body.role;
        const company = req.body.company;
        const exp = req.body.experience;

        let data = await db.query("INSERT INTO resource(student_id, role, company, experience) VALUES ($1, $2, $3, $4) RETURNING resource_id", [currentStudentID, role, company, exp]);
        let id = data.rows[0].resource_id

      for (const file of req.files) {
        console.log(file.originalname);
        const fileData = fs.readFileSync(file.path); 
        const query = 'INSERT INTO resource_document (resource_id, document_name, document) VALUES ($1, $2, $3)';
        await db.query(query, [id, file.originalname, fileData]); 
      }
      //res.render("show-resource.ejs");
      res.send('Files uploaded and inserted into the database successfully');
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  app.get("/resources", async (req, res) => {

    try {
        const data = await db.query(`
            SELECT 
                student.first_name,
                student.course,
                student.end_year,
                resource.role,
                resource.company,
                resource.experience,
                resource.resource_id
            FROM 
                student
            JOIN 
                resource ON student.student_id = resource.student_id
        `);

        const combinedDataWithDocuments = [];
        for (const row of data.rows) {
            const documents = await db.query(`
                SELECT 
                    document,
                    document_name
                FROM 
                    resource_document 
                WHERE 
                resource_id = $1
            `, [row.resource_id]);
            
            // Extracting document names and documents from the fetched rows
            const documentsArray = documents.rows.map(row => ({
                document: row.document,
                document_name: row.document_name
            }));


            // Combine resource data with documents
            const combinedRow = {
                ...row,
                documents: documentsArray
            };

            await combinedDataWithDocuments.push(combinedRow);
        }

        console.log(combinedDataWithDocuments);

        res.render("show-resource.ejs", {
            data: combinedDataWithDocuments,
            isAlumni: isAlumni
        });
    } catch (error) {
        console.error(error);
        throw new Error("Failed to fetch combined data with documents");
    }
});

app.get('/download/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    let filePath = path.join(__dirname, 'uploads', fileName); // Adjust the path to match the directory where your files are stored
    filePath = filePath.substring(3);

    try {
                const fileContent = fs.readFileSync(filePath);
            } catch (error) {
                console.error('Error reading file:', error);
            }
    try {
        if (fs.existsSync(filePath)) {
            res.setHeader('Content-disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-type', 'application/pdf'); // Adjust the content type based on the file type

            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
        } else {
            res.status(404).send('File not found');
        }
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).send('Internal Server Error');
    }
});



app.get("/add-resource", async (req, res) => {
    res.render("add-resource.ejs");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});