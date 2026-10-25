
"use strict";

/* =========================================
   CAREERHUB - FRONTEND APPLICATION
   API: http://localhost:3000/api
   ========================================= */

const API_URL = "http://localhost:3000/api";

const $ = (selector) => document.querySelector(selector);

const elements = {
  jobList: $("#jobList"),
  savedJobList: $("#savedJobList"),
  resultsCount: $("#resultsCount"),
  searchForm: $("#jobSearchForm"),
  searchInput: $("#searchInput"),
  categoryFilter: $("#categoryFilter"),
  locationFilter: $("#locationFilter"),
  typeFilter: $("#typeFilter"),
  salaryFilter: $("#salaryFilter"),
  sortJobs: $("#sortJobs"),
  filterTabs: $("#filterTabs"),
  applyFiltersBtn: $("#applyFiltersBtn"),
  clearFiltersBtn: $("#clearFiltersBtn"),
  loadMoreBtn: $("#loadMoreBtn"),

  jobModal: $("#jobModal"),
  jobForm: $("#jobForm"),
  jobModalTitle: $("#jobModalTitle"),
  jobId: $("#jobId"),
  jobTitle: $("#jobTitle"),
  jobCompany: $("#jobCompany"),
  jobLocation: $("#jobLocation"),
  jobCategory: $("#jobCategory"),
  jobType: $("#jobType"),
  jobSalary: $("#jobSalary"),
  jobDescription: $("#jobDescription"),
  jobSkills: $("#jobSkills"),
  saveJobBtn: $("#saveJobBtn"),

  detailsModal: $("#detailsModal"),
  detailsTitle: $("#detailsTitle"),
  jobDetailsContent: $("#jobDetailsContent"),
  detailsApplyBtn: $("#detailsApplyBtn"),

  applyModal: $("#applyModal"),
  applyForm: $("#applyForm"),
  applyJobId: $("#applyJobId"),
  applyJobSummary: $("#applyJobSummary"),
  applicantName: $("#applicantName"),
  applicantEmail: $("#applicantEmail"),
  applicantPhone: $("#applicantPhone"),
  applicantResume: $("#applicantResume"),

  applicationHistory: $("#applicationHistory"),
  refreshApplicationsBtn: $("#refreshApplicationsBtn"),
  savedNavBtn: $("#savedNavBtn"),
  postJobNavBtn: $("#postJobNavBtn"),
  postJobCtaBtn: $("#postJobCtaBtn"),
  backToJobsBtn: $("#backToJobsBtn"),
  menuToggle: $("#menuToggle"),
  toast: $("#toast")
};

const state = {
  jobs: [],
  applications: [],
  savedJobIds: readSavedJobs(),
  activeFilter: "All",
  searchText: "",
  currentPage: 1,
  pageSize: 6,
  currentDetailsJobId: null,
  loading: false
};

/* -----------------------------------------
   GENERAL HELPERS
----------------------------------------- */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function normalise(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getJobId(job) {
  return String(job?.id ?? "");
}

function getSalary(job) {
  const salary = Number(job?.salary ?? job?.monthly_salary ?? 0);
  return Number.isFinite(salary) ? salary : 0;
}

function getJobType(job) {
  return String(job?.type ?? job?.job_type ?? "Full Time");
}

function getJobSkills(job) {
  const skills = job?.skills;

  if (Array.isArray(skills)) {
    return skills.map(String);
  }

  if (typeof skills === "string" && skills.trim()) {
    return skills.split(",").map((skill) => skill.trim()).filter(Boolean);
  }

  return [];
}

function formatSalary(salary) {
  if (!Number(salary)) return "Salary not specified";

  return "₹" + Number(salary).toLocaleString("en-IN") + "/month";
}

function formatDate(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function showToast(message) {
  if (!elements.toast) return;

  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 3000);
}

function setButtonLoading(button, loading, loadingText = "Please wait...") {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const responseText = await response.text();
  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText };
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Request failed (${response.status})`;

    throw new Error(message);
  }

  return data;
}

function readSavedJobs() {
  try {
    const saved = JSON.parse(localStorage.getItem("careerhub_saved_jobs") || "[]");
    return Array.isArray(saved) ? saved.map(String) : [];
  } catch {
    return [];
  }
}

function saveSavedJobs() {
  try {
    localStorage.setItem(
      "careerhub_saved_jobs",
      JSON.stringify(state.savedJobIds)
    );
  } catch {
    showToast("Could not save jobs in this browser.");
  }

  updateDashboard();
}

/* -----------------------------------------
   DATA LOADING
----------------------------------------- */

async function loadJobs() {
  if (state.loading) return;

  state.loading = true;

  if (elements.jobList) {
    elements.jobList.innerHTML =
      '<div class="loading-state">Loading opportunities...</div>';
  }

  try {
    const result = await apiRequest("/jobs");
    const jobs = Array.isArray(result) ? result : result?.jobs;

    if (!Array.isArray(jobs)) {
      throw new Error("The jobs API returned an unexpected response.");
    }

    state.jobs = jobs;
    renderJobs();
    renderSavedJobs();
    updateDashboard();
  } catch (error) {
    console.error("Could not load jobs:", error);

    if (elements.jobList) {
      elements.jobList.innerHTML = `
        <div class="empty-state">
          <h3>Couldn't load jobs</h3>
          <p>${escapeHTML(error.message)}</p>
          <p>Check that the CareerHub backend is running, then try again.</p>
          <button class="btn btn-primary" id="retryJobsBtn" type="button">
            Try again
          </button>
        </div>`;
    }

    if (elements.resultsCount) {
      elements.resultsCount.textContent = "Unable to load jobs";
    }

    updateDashboard();
  } finally {
    state.loading = false;
  }
}

async function loadApplications() {
  if (!elements.applicationHistory) return;

  elements.applicationHistory.innerHTML =
    '<tr><td colspan="4" class="empty-cell">Loading applications...</td></tr>';

  try {
    const result = await apiRequest("/applications");
    state.applications = Array.isArray(result)
      ? result
      : (Array.isArray(result?.applications) ? result.applications : []);

    renderApplications();
    updateDashboard();
  } catch (error) {
    console.error("Could not load applications:", error);

    elements.applicationHistory.innerHTML = `
      <tr>
        <td colspan="4" class="empty-cell">
          Could not load applications. ${escapeHTML(error.message)}
        </td>
      </tr>`;
  }
}

/* -----------------------------------------
   JOB SEARCH AND FILTERS
----------------------------------------- */

function getFilteredJobs() {
  const search = normalise(state.searchText);
  const category = normalise(elements.categoryFilter?.value);
  const location = normalise(elements.locationFilter?.value);
  const type = normalise(elements.typeFilter?.value);
  const minimumSalary = Number(elements.salaryFilter?.value || 0);

  let jobs = state.jobs.filter((job) => {
    const title = normalise(job.title);
    const company = normalise(job.company);
    const jobLocation = normalise(job.location);
    const jobCategory = normalise(job.category);
    const jobType = normalise(getJobType(job));
    const description = normalise(job.description);
    const skills = normalise(getJobSkills(job).join(" "));

    const matchesSearch =
      !search ||
      [title, company, jobLocation, jobCategory, description, skills]
        .some((value) => value.includes(search));

    const matchesCategory =
      !category || jobCategory === category ||
      (category === "it" && (
        jobCategory.includes("software") ||
        jobCategory.includes("technology")
      ));

    const matchesLocation =
      !location || jobLocation.includes(location) ||
      (location === "remote" && jobLocation.includes("remote"));

    const matchesType =
      !type || jobType === normalise(type);

    const matchesTab = (() => {
      if (state.activeFilter === "All") return true;

      if (state.activeFilter === "Remote") {
        return jobLocation.includes("remote");
      }

      return jobType === normalise(state.activeFilter);
    })();

    const matchesSalary = getSalary(job) >= minimumSalary;

    return matchesSearch &&
      matchesCategory &&
      matchesLocation &&
      matchesType &&
      matchesTab &&
      matchesSalary;
  });

  const sortBy = elements.sortJobs?.value || "newest";

  if (sortBy === "salary") {
    jobs.sort((a, b) => getSalary(b) - getSalary(a));
  } else if (sortBy === "company") {
    jobs.sort((a, b) =>
      String(a.company || "").localeCompare(String(b.company || ""))
    );
  } else {
    jobs.sort((a, b) => {
      const dateA = new Date(a.created_at || a.posted_at || 0).getTime();
      const dateB = new Date(b.created_at || b.posted_at || 0).getTime();
      return dateB - dateA;
    });
  }

  return jobs;
}

function applySearch() {
  state.searchText = elements.searchInput?.value.trim() || "";
  state.currentPage = 1;
  renderJobs();
}

function clearFilters() {
  if (elements.searchInput) elements.searchInput.value = "";
  if (elements.categoryFilter) elements.categoryFilter.value = "";
  if (elements.locationFilter) elements.locationFilter.value = "";
  if (elements.typeFilter) elements.typeFilter.value = "";
  if (elements.salaryFilter) elements.salaryFilter.value = "0";
  if (elements.sortJobs) elements.sortJobs.value = "newest";

  state.searchText = "";
  state.activeFilter = "All";
  state.currentPage = 1;

  document.querySelectorAll(".filter-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === "All");
  });

  renderJobs();
}

/* -----------------------------------------
   JOB CARDS
----------------------------------------- */

function renderJobCard(job) {
  const id = getJobId(job);
  const saved = state.savedJobIds.includes(id);
  const title = escapeHTML(job.title || "Untitled position");
  const company = escapeHTML(job.company || "Company not specified");
  const location = escapeHTML(job.location || "Location not specified");
  const category = escapeHTML(job.category || "Other");
  const type = escapeHTML(getJobType(job));
  const salary = escapeHTML(formatSalary(getSalary(job)));
  const initial = escapeHTML(
    String(job.company || "C").trim().charAt(0).toUpperCase()
  );

  const description = String(job.description || "");
  const shortDescription = description.length > 100
    ? description.slice(0, 100) + "..."
    : description;

  return `
    <article class="job-card" data-job-id="${escapeHTML(id)}">
      <div class="job-card-top">
        <div class="company-logo" aria-label="${company} logo">${initial}</div>
        <button
          class="save-job-btn ${saved ? "saved" : ""}"
          type="button"
          data-action="save"
          data-id="${escapeHTML(id)}"
          aria-label="${saved ? "Unsave" : "Save"} ${title}"
          aria-pressed="${saved}"
          title="${saved ? "Remove from saved jobs" : "Save job"}"
        >${saved ? "♥" : "♡"}</button>
      </div>

      <h3>${title}</h3>
      <p class="job-company">${company}</p>

      <div class="job-tags">
        <span class="job-tag">${type}</span>
        <span class="job-tag neutral">${category}</span>
      </div>

      <p class="job-location">⌖ ${location}</p>
      ${description ? `<p class="job-company">${escapeHTML(shortDescription)}</p>` : ""}
      <div class="job-salary">${salary}</div>

      <div class="job-card-footer">
        <button class="btn btn-light" type="button"
          data-action="details" data-id="${escapeHTML(id)}">
          View Details
        </button>
        <button class="btn btn-primary" type="button"
          data-action="apply" data-id="${escapeHTML(id)}">
          Apply Now
        </button>
      </div>

      <div class="job-management">
        <button type="button" data-action="edit" data-id="${escapeHTML(id)}">✏️ Edit Job</button>
        <button type="button" data-action="delete" data-id="${escapeHTML(id)}">🗑 Delete Job</button>
      </div>
    </article>`;
}

function renderJobs() {
  if (!elements.jobList) return;

  const jobs = getFilteredJobs();
  const visibleJobs = jobs.slice(0, state.currentPage * state.pageSize);

  if (elements.resultsCount) {
    elements.resultsCount.textContent =
      `${jobs.length} job${jobs.length === 1 ? "" : "s"} found`;
  }

  if (!jobs.length) {
    elements.jobList.innerHTML = `
      <div class="empty-state">
        <h3>No jobs found</h3>
        <p>Try another keyword or clear the filters to see more opportunities.</p>
        <button class="btn btn-primary" type="button" data-action="clear-filters">
          Clear filters
        </button>
      </div>`;
  } else {
    elements.jobList.innerHTML = visibleJobs.map(renderJobCard).join("");
  }

  if (elements.loadMoreBtn) {
    elements.loadMoreBtn.hidden = visibleJobs.length >= jobs.length;
  }

  updateDashboard();
}

function renderSavedJobs() {
  if (!elements.savedJobList) return;

  const savedJobs = state.jobs.filter((job) =>
    state.savedJobIds.includes(getJobId(job))
  );

  if (!savedJobs.length) {
    elements.savedJobList.innerHTML = `
      <div class="empty-state">
        <h3>No saved jobs yet</h3>
        <p>Click the heart icon on any job to save it here.</p>
      </div>`;
    return;
  }

  elements.savedJobList.innerHTML = savedJobs.map(renderJobCard).join("");
}

/* -----------------------------------------
   SAVE / UNSAVE JOBS
----------------------------------------- */

function toggleSavedJob(id) {
  if (!id) return;

  if (state.savedJobIds.includes(id)) {
    state.savedJobIds = state.savedJobIds.filter((savedId) => savedId !== id);
    showToast("Job removed from saved jobs.");
  } else {
    state.savedJobIds.push(id);
    showToast("Job saved successfully!");
  }

  saveSavedJobs();
  renderJobs();
  renderSavedJobs();
}

/* -----------------------------------------
   JOB DETAILS
----------------------------------------- */

function findJob(id) {
  return state.jobs.find((job) => getJobId(job) === String(id));
}

function openDetails(id) {
  const job = findJob(id);

  if (!job) {
    showToast("Job not found. Refresh the jobs list.");
    return;
  }

  state.currentDetailsJobId = getJobId(job);

  if (elements.detailsTitle) {
    elements.detailsTitle.textContent = job.title || "Job details";
  }

  const skills = getJobSkills(job);

  if (elements.jobDetailsContent) {
    elements.jobDetailsContent.innerHTML = `
      <p class="job-company">${escapeHTML(job.company || "Company not specified")}</p>
      <div class="details-meta">
        <span class="job-tag">${escapeHTML(getJobType(job))}</span>
        <span class="job-tag">${escapeHTML(job.category || "Other")}</span>
        <span class="job-tag neutral">${escapeHTML(job.location || "Location not specified")}</span>
      </div>
      <p class="job-salary">${escapeHTML(formatSalary(getSalary(job)))}</p>
      <h3 style="margin-top:20px">Job description</h3>
      <p class="details-description">${escapeHTML(job.description || "No description provided.")}</p>
      ${skills.length ? `
        <h3>Skills</h3>
        <div class="job-tags details-skills">
          ${skills.map((skill) => `<span class="job-tag">${escapeHTML(skill)}</span>`).join("")}
        </div>` : ""}
      <p class="job-company">Posted: ${escapeHTML(formatDate(job.created_at || job.posted_at))}</p>
    `;
  }

  openDialog(elements.detailsModal);
}

function openDialog(dialog) {
  if (!dialog) return;

  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }

  document.body.classList.add("modal-open");
}

function closeDialog(dialog) {
  if (!dialog) return;

  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }

  if (!document.querySelector("dialog[open]")) {
    document.body.classList.remove("modal-open");
  }
}

/* -----------------------------------------
   ADD / EDIT JOB
----------------------------------------- */

function openJobForm(job = null) {
  if (!elements.jobForm) return;

  elements.jobForm.reset();
  elements.jobId.value = job ? getJobId(job) : "";

  elements.jobModalTitle.textContent = job ? "Edit job" : "Post a job";
  elements.saveJobBtn.textContent = job ? "Update Job" : "Save Job";

  if (job) {
    elements.jobTitle.value = job.title || "";
    elements.jobCompany.value = job.company || "";
    elements.jobLocation.value = job.location || "";
    elements.jobCategory.value = job.category || "IT";
    elements.jobType.value = getJobType(job);
    elements.jobSalary.value = getSalary(job) || "";
    elements.jobDescription.value = job.description || "";
    elements.jobSkills.value = getJobSkills(job).join(", ");
  }

  openDialog(elements.jobModal);
}

async function submitJobForm(event) {
  event.preventDefault();

  const id = elements.jobId.value.trim();

  const jobData = {
    title: elements.jobTitle.value.trim(),
    company: elements.jobCompany.value.trim(),
    location: elements.jobLocation.value.trim(),
    category: elements.jobCategory.value,
    type: elements.jobType.value,
    salary: Number(elements.jobSalary.value),
    description: elements.jobDescription.value.trim(),
    skills: elements.jobSkills.value
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean)
  };

  if (!jobData.title || !jobData.company || !jobData.location ||
      !jobData.description || !Number.isFinite(jobData.salary) ||
      jobData.salary < 0) {
    showToast("Please fill all required fields correctly.");
    return;
  }

  setButtonLoading(elements.saveJobBtn, true, id ? "Updating..." : "Saving...");

  try {
    await apiRequest(id ? `/jobs/${encodeURIComponent(id)}` : "/jobs", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(jobData)
    });

    closeDialog(elements.jobModal);
    showToast(id ? "Job updated successfully!" : "Job posted successfully!");

    state.currentPage = 1;
    await loadJobs();
  } catch (error) {
    console.error("Could not save job:", error);
    showToast(`Could not ${id ? "update" : "post"} job: ${error.message}`);
  } finally {
    setButtonLoading(elements.saveJobBtn, false);
  }
}

function editJob(id) {
  const job = findJob(id);

  if (!job) {
    showToast("Job not found.");
    return;
  }

  openJobForm(job);
}

async function deleteJob(id) {
  const job = findJob(id);
  if (!job) return;

  const confirmed = window.confirm(
    `Delete "${job.title}" at "${job.company}"? This action cannot be undone.`
  );

  if (!confirmed) return;

  try {
    await apiRequest(`/jobs/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    state.savedJobIds = state.savedJobIds.filter((savedId) => savedId !== id);
    saveSavedJobs();

    showToast("Job deleted successfully!");
    await loadJobs();
    await loadApplications();
  } catch (error) {
    console.error("Could not delete job:", error);
    showToast(`Could not delete job: ${error.message}`);
  }
}

/* -----------------------------------------
   APPLY FOR JOB
----------------------------------------- */

function openApplyForm(id) {
  const job = findJob(id);

  if (!job) {
    showToast("Job not found.");
    return;
  }

  elements.applyForm.reset();
  elements.applyJobId.value = getJobId(job);
  elements.applyJobSummary.textContent =
    `${job.title} at ${job.company} · ${job.location}`;

  openDialog(elements.applyModal);
}

async function submitApplication(event) {
  event.preventDefault();

  const id = elements.applyJobId.value.trim();

  const applicationData = {
    job_id: id,
    applicant_name: elements.applicantName.value.trim(),
    applicant_email: elements.applicantEmail.value.trim(),
    applicant_phone: elements.applicantPhone.value.trim(),
    resume_url: elements.applicantResume.value.trim()
  };

  if (!applicationData.applicant_name || !applicationData.applicant_email) {
    showToast("Please enter your name and email.");
    return;
  }

  const submitButton = elements.applyForm.querySelector('button[type="submit"]');
  setButtonLoading(submitButton, true, "Submitting...");

  try {
    await apiRequest("/applications", {
      method: "POST",
      body: JSON.stringify(applicationData)
    });

    closeDialog(elements.applyModal);
    showToast("Application submitted successfully!");

    await loadApplications();
    document.querySelector("#applications")?.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    console.error("Could not submit application:", error);
    showToast(`Could not submit application: ${error.message}`);
  } finally {
    setButtonLoading(submitButton, false);
  }
}

/* -----------------------------------------
   APPLICATION HISTORY AND STATUS
----------------------------------------- */

function renderApplications() {
  if (!elements.applicationHistory) return;

  if (!state.applications.length) {
    elements.applicationHistory.innerHTML = `
      <tr><td colspan="4" class="empty-cell">
        No applications yet. Apply for a job to see your history here.
      </td></tr>`;
    return;
  }

  elements.applicationHistory.innerHTML = state.applications.map((application) => {
    const job = findJob(application.job_id);
    const jobTitle = application.job_title || application.title || job?.title || "Job";
    const company = application.company || job?.company || "—";
    const date = application.applied_at || application.created_at || application.application_date;
    const status = application.status || "Applied";
    const id = application.id;

    const allowedStatuses = ["Applied", "Under Review", "Shortlisted", "Rejected"];

    return `
      <tr>
        <td>${escapeHTML(jobTitle)}</td>
        <td>${escapeHTML(company)}</td>
        <td>${escapeHTML(formatDate(date))}</td>
        <td>
          <select class="status-select" data-action="status"
            data-id="${escapeHTML(id)}"
            aria-label="Update status for ${escapeHTML(jobTitle)}">
            ${allowedStatuses.map((value) => `
              <option value="${escapeHTML(value)}" ${value === status ? "selected" : ""}>
                ${escapeHTML(value)}
              </option>`).join("")}
          </select>
        </td>
      </tr>`;
  }).join("");
}

async function updateApplicationStatus(id, status, selectElement) {
  const allowedStatuses = ["Applied", "Under Review", "Shortlisted", "Rejected"];

  if (!allowedStatuses.includes(status)) {
    showToast("Invalid application status.");
    return;
  }

  if (selectElement) selectElement.disabled = true;

  try {
    await apiRequest(`/applications/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });

    showToast("Application status updated.");
    await loadApplications();
  } catch (error) {
    console.error("Could not update application status:", error);
    showToast(`Could not update status: ${error.message}`);
    await loadApplications();
  } finally {
    if (selectElement) selectElement.disabled = false;
  }
}

/* -----------------------------------------
   DASHBOARD STATISTICS
----------------------------------------- */

function updateDashboard() {
  const companyCount = new Set(
    state.jobs.map((job) => normalise(job.company)).filter(Boolean)
  ).size;

  if ($("#totalJobs")) {
    $("#totalJobs").textContent = state.jobs.length.toLocaleString("en-IN");
  }

  if ($("#totalCompanies")) {
    $("#totalCompanies").textContent = companyCount.toLocaleString("en-IN");
  }

  if ($("#totalApplications")) {
    $("#totalApplications").textContent =
      state.applications.length.toLocaleString("en-IN");
  }

  if ($("#totalSaved")) {
    const validSavedJobs = state.savedJobIds.filter((id) =>
      state.jobs.some((job) => getJobId(job) === id)
    ).length;

    $("#totalSaved").textContent = validSavedJobs.toLocaleString("en-IN");
  }
}

/* -----------------------------------------
   NAVIGATION
----------------------------------------- */

function showSavedJobs() {
  const section = $("#savedJobsSection");
  if (!section) return;

  section.hidden = false;
  renderSavedJobs();
  section.scrollIntoView({ behavior: "smooth" });
}

function hideSavedJobs() {
  const section = $("#savedJobsSection");
  if (section) section.hidden = true;

  document.querySelector("#jobs")?.scrollIntoView({ behavior: "smooth" });
}

function closeMobileMenu() {
  if (!elements.menuToggle) return;

  elements.menuToggle.setAttribute("aria-expanded", "false");
  document.querySelector(".nav-links")?.classList.remove("open");
}

/* -----------------------------------------
   EVENT LISTENERS
----------------------------------------- */

function attachEventListeners() {
  elements.searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    applySearch();
    document.querySelector("#jobs")?.scrollIntoView({ behavior: "smooth" });
  });

  elements.searchInput?.addEventListener("input", () => {
    state.searchText = elements.searchInput.value.trim();
    state.currentPage = 1;
    renderJobs();
  });

  elements.categoryFilter?.addEventListener("change", applySearch);
  elements.locationFilter?.addEventListener("input", applySearch);
  elements.typeFilter?.addEventListener("change", applySearch);
  elements.salaryFilter?.addEventListener("change", applySearch);
  elements.sortJobs?.addEventListener("change", renderJobs);

  elements.filterTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    state.activeFilter = button.dataset.filter;
    state.currentPage = 1;

    document.querySelectorAll(".filter-tab").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });

    renderJobs();
  });

  document.querySelectorAll(".search-chip").forEach((button) => {
    button.addEventListener("click", () => {
      if (elements.searchInput) {
        elements.searchInput.value = button.dataset.search || "";
      }

      applySearch();
      document.querySelector("#jobs")?.scrollIntoView({ behavior: "smooth" });
    });
  });

  elements.applyFiltersBtn?.addEventListener("click", () => {
    applySearch();
    document.querySelector("#jobs")?.scrollIntoView({ behavior: "smooth" });
  });

  elements.clearFiltersBtn?.addEventListener("click", clearFilters);

  elements.loadMoreBtn?.addEventListener("click", () => {
    state.currentPage += 1;
    renderJobs();
  });

  elements.jobList?.addEventListener("click", handleJobListClick);
  elements.savedJobList?.addEventListener("click", handleJobListClick);

  elements.jobForm?.addEventListener("submit", submitJobForm);
  elements.applyForm?.addEventListener("submit", submitApplication);

  elements.detailsApplyBtn?.addEventListener("click", () => {
    const id = state.currentDetailsJobId;
    closeDialog(elements.detailsModal);

    if (id) openApplyForm(id);
  });

  elements.postJobNavBtn?.addEventListener("click", () => openJobForm());
  elements.postJobCtaBtn?.addEventListener("click", () => openJobForm());
  elements.savedNavBtn?.addEventListener("click", showSavedJobs);
  elements.backToJobsBtn?.addEventListener("click", hideSavedJobs);

  elements.refreshApplicationsBtn?.addEventListener("click", loadApplications);

  elements.menuToggle?.addEventListener("click", () => {
    const nav = document.querySelector(".nav-links");
    if (!nav) return;

    const isOpen = nav.classList.toggle("open");
    elements.menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      closeDialog(document.getElementById(button.dataset.close));
    });
  });

  document.querySelectorAll("dialog.modal").forEach((dialog) => {
    dialog.addEventListener("close", () => {
      if (!document.querySelector("dialog[open]")) {
        document.body.classList.remove("modal-open");
      }
    });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        closeDialog(dialog);
      }
    });
  });

  elements.applicationHistory?.addEventListener("change", (event) => {
    const select = event.target.closest('[data-action="status"]');
    if (!select) return;

    updateApplicationStatus(select.dataset.id, select.value, select);
  });

  // Retry button is created dynamically when the jobs API fails.
  elements.jobList?.addEventListener("click", (event) => {
    if (event.target.closest("#retryJobsBtn")) {
      loadJobs();
    }
  });

  // Keep the footer year current.
  if ($("#currentYear")) {
    $("#currentYear").textContent = new Date().getFullYear();
  }
}

function handleJobListClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  switch (action) {
    case "save":
      toggleSavedJob(id);
      break;
    case "details":
      openDetails(id);
      break;
    case "apply":
      openApplyForm(id);
      break;
    case "edit":
      editJob(id);
      break;
    case "delete":
      deleteJob(id);
      break;
    case "clear-filters":
      clearFilters();
      break;
  }
}

/* -----------------------------------------
   START APPLICATION
----------------------------------------- */

document.addEventListener("DOMContentLoaded", async () => {
  attachEventListeners();

  await Promise.all([
    loadJobs(),
    loadApplications()
  ]);
});
