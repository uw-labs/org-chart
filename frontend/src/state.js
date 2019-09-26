import URL from 'url-parse'

import Couch from "davenport";

export const STREAM = {
    ENGINEERING: 'ENGINEERING',
    OPERATIONS: 'OPERATIONS',
    PRODUCT: 'PRODUCT',
    PORTFOLIO: 'PORTFOLIO',
    DATA: 'DATA',
    DESIGN: 'DESIGN',
}

export const KIND = {
    EMPLOYEE: 'EMPLOYEE',
    DEPARTMENT: 'DEPARTMENT',
    TRIBE: 'TRIBE',
    SQUAD: 'SQUAD',
    TEAM: 'TEAM',
    UNIT: 'UNIT'
}

export const TYPE = {
    EMPLOYEE: 'EMPLOYEE',
    TEMP: 'TEMP',
    CONTRACTOR: 'CONTRACTOR',
    AGENCY_CONTRACTOR: 'AGENCY_CONTRACTOR',
}

class Employee {
    constructor(id, name, title, reportsTo, memberOf, stream, number, github, startDate, type) {
        this.id = id
        this.name = name
        this.title = title
        this.reportsTo = reportsTo
        this.memberOf = memberOf
        this.stream = stream
        this.number = number
        this.github = github
        this.startDate = startDate || ""
        this.type = type || TYPE.EMPLOYEE
    }
}

class Team {
    constructor(id, name, kind, parent, vacancies, techLead, productLead, description, backfills) {
        this.id = id
        this.name = name
        this.kind = kind
        this.parent = parent
        this.vacancies = vacancies || {}
        this.backfills = backfills || {}
        this.techLead = techLead
        this.productLead = productLead
        this.description = description
    }
}

class Organisation {
    constructor(employees, teams) {
        this.employees = employees
        this.teams = teams
    }

    toLiteral() {
        return {
            employees: this.employees.map(e => Object.assign({}, e)).sort((a, b) => {
                if (a.name === b.name) return 0
                return (a.name > b.name) ? 1 : -1
            }),
            teams: this.teamHierarchy(),
            reporting: this.reportingHierarchy(),
            rootEmployee: this.rootEmployee,
        }
    }

    teamsById() {
        const byId = {}

        this.teams.forEach(t => {
            byId[t.id] = t;
        })

        return byId
    }

    reportingHierarchy() {

        const root = this.rootEmployee;

        const teamsById = {}

        this.teams.forEach(t => {
            teamsById[t.id] = t
        })

        const employeesById = {}

        this.employees.forEach(e => {
            const employee = Object.assign({}, e)
            employee.children = []
            employeesById[e.id] = employee

            if (!employee.memberOf) { //no team assoc
                employee.reportsTo = root
                return
            }

            if (!employee.reportsTo) {
                let team = teamsById[employee.memberOf]

                if (team.techLead === employee.id || team.productLead === employee.id) {
                    team = teamsById[team.parent]
                }

                if (!team) {
                    employee.reportsTo = root
                } else {
                    employee.reportsTo = findLeadUpFromFor(team, teamsById, employee) || root
                }
            }
        })

        Object.values(employeesById).forEach(employee => {
            if (employee.id === root) return;

            const lead = employeesById[employee.reportsTo]

            lead.children.push(employee)
        })

        return employeesById[root]

    }

    teamHierarchy() {
        const hierarchy = {}
        this.teams.forEach(t => {
            hierarchy[t.id] = Object.assign({}, t)
            hierarchy[t.id].children = []
            hierarchy[t.id].members = []
        })

        const root = this.teams.filter(t => !t.parent)

        if (root.length === 0) {
            return null
            //throw new Error("Error while building team hierarchy, no root.")
        }

        if (root.length > 1) {
            throw new Error(`Error while building team hierarchy, more than one root defined [${root.map(t => t.id).join(', ')}].`)
        }

        const employeesById = {}

        this.employees.forEach(e => {
            employeesById[e.id] = e
        })

        const rootTeam = hierarchy[root[0].id]

        this.teams.forEach(t => {
            if (t.parent) {

                if (!hierarchy[t.parent]) {
                    throw new Error(`Error while building team hierarchy, parent ${t.parent} not found for team ${t.name}`)
                }

                hierarchy[t.parent].children.push(hierarchy[t.id])
            }

            if (t.techLead && employeesById[t.techLead]) {
                hierarchy[t.id].techLead = Object.assign({}, employeesById[t.techLead])
            }

            if (t.productLead && employeesById[t.productLead]) {
                hierarchy[t.id].productLead = Object.assign({}, employeesById[t.productLead])
            }

        })

        this.employees.forEach(e => {

            if (e.memberOf) {

                if (!hierarchy[e.memberOf]) {
                    throw new Error(`Error while building team hierarchy, team ${e.memberOf} not found for employee ${e.name}`)
                }

                hierarchy[e.memberOf].members.push(Object.assign({}, e))
            }
        })

        return rootTeam
    }

    reparentTeam(team, to) {
        this.teams.find(t => t.id === team).parent = to
    }

    removeFromTeam(employee) {
        this.employees.find(e => e.id === employee).memberOf = null
    }

    addToTeam(employee, team) {
        this.employees.find(e => e.id === employee).memberOf = team
    }

    toJSON() {
        return JSON.stringify({
            employees: this.employees.sort((a, b) => {
                if (a.name === b.name) return 0
                return (a.name > b.name) ? 1 : -1
            }),
            teams: this.teams.sort((a, b) => {
                if (a.name === b.name) return 0
                return (a.name > b.name) ? 1 : -1
            }),
            rootEmployee: this.rootEmployee,
        }, null, 2)
    }

    fromJSON(jsonString) {

        try {

            const data = JSON.parse(jsonString)

            this.parseData(data)

        } catch(err) {
            alert("JSON.parse error, check console")
        }
    }

    parseData(data) {
        this.employees = data.employees.map(e => Object.assign(new Employee(), e))
        this.teams = data.teams.map(e => Object.assign(new Team(), e))

        this.rootEmployee = data.rootEmployee || "damon_petta";

    }

    changeHeadcount(team, stream, headcount) {
        headcount = parseInt(headcount, 10)
        if (isNaN(headcount)) {
            headcount = undefined
        }
        this.teams.find(t => t.id === team).vacancies[stream] = headcount
    }

    changeBackfills(team, stream, headcount) {
        headcount = parseInt(headcount, 10)
        if (isNaN(headcount)) {
            headcount = undefined
        }
        this.teams.find(t => t.id === team).backfills[stream] = headcount
    }

    addNewTeam(name, kind, parent, description) {
        this.teams.push(new Team(makeTeamId(name, kind), name, kind, parent, undefined, undefined, undefined, description))
    }

    changeTeamName(team, newName) {
        this.teams.find(t => t.id === team).name = newName
    }

    changeTeamDescription(team, newDescription) {
        this.teams.find(t => t.id === team).description = newDescription
    }

    async saveData(url) {

        const parsedURL = new URL(url);

        if (!parsedURL.protocol.startsWith("couch")) {
            alert("Unsupported storage, try couchdb://")
            return
        }

        if (parsedURL.protocol.startsWith("couchdbs")) {
            parsedURL.protocol = "https:"
        } else {
            parsedURL.protocol = "http:"
        }

        const couch = new Couch(parsedURL.protocol+"//"+parsedURL.host, parsedURL.pathname.substr(1))

        await couch.put(
            "chart",
            {employees: this.employees, teams: this.teams},
            this.documentRevision,
        )
        .then(res => {
            this.documentRevision  = res.rev
        })
        .catch(err => {
            alert("failed to save data: " + err.message)
        })
    }

    async loadData(url) {

        try {

            const parsedURL = new URL(url);

            let data;
            let dataURL;
            let persistURL = undefined;

            // couchdb://user:pass@0.0.0.0:5984/it-org-chart

            if (parsedURL.protocol.startsWith("couch")) {
                // couch URL

                persistURL = url

                const loadURL = new URL(url);

                loadURL.auth = ""
                loadURL.password = ""
                loadURL.username = ""

                dataURL = loadURL.toString()


                if (parsedURL.protocol.startsWith("couchdbs")) {
                    parsedURL.protocol = "https:"
                } else {
                    parsedURL.protocol = "http:"
                }

                const couch = new Couch(parsedURL.protocol+"//"+parsedURL.host, parsedURL.pathname.substr(1))

                data = await couch.get("chart").then(data => {
                    this.documentRevision = data._rev
                    return {employees: [], teams: [], ...data}
                }).catch(err => {
                    alert("failed to load data: " + err.message)
                    return data = {"employees": [], "teams": []}
                })


            } else {
                const response = await fetch(url)
                data = await response.json()

                dataURL = url
            }

            localStorage.setItem("dataURL", dataURL)
            localStorage.setItem("persistURL", persistURL)

            return this.parseData(data)

        } catch(err) {
            alert("failed to load: " + err.message)
        }

    }

    removeTeam(team) {
        const teamToRemove = this.teams.find(t => t.id === team)

        this.employees.forEach(e => {
            if (e.memberOf === team) {
                e.memberOf = undefined
            }
        })

        const parentTeamId = teamToRemove.parent

        this.teams.forEach(e => {
            if (e.parent === team) {
                e.parent = parentTeamId
            }
        })

        this.teams = this.teams.filter(t => t.id !== team)
    }

    addEmployee(name, title, stream, reportsTo, employee, github, startDate, type) {
        this.employees.push(new Employee(makeEmployeeId(name), name, title, reportsTo, undefined, stream, employee, github, startDate === "" ? null : startDate, type))
    }

    editEmployee(id, name, title, stream, reportsTo, employeeNumber, github, startDate, type) {
        const employee = this.employees.find(e => e.id === id)

        employee.name = name
        employee.title = title
        employee.stream = stream
        employee.reportsTo = reportsTo
        employee.number = employeeNumber
        employee.github = github
        employee.startDate = startDate === "" ? null : startDate
        employee.type = type

    }

    removeEmployee(id) {

        this.employees.filter(e => e.reportsTo === id).forEach(e => {
            e.reportsTo = undefined
        })

        this.teams.filter(t => t.techLead === id).forEach(t => {
            t.techLead = undefined
        })

        this.teams.filter(t => t.productLead === id).forEach(t => {
            t.productLead = undefined
        })

        this.employees = this.employees.filter(e => e.id !== id)
    }

    setTechLead(team, lead) {
        this.teams.find(t => t.id === team).techLead = lead
    }

    setProductLead(team, lead) {
        this.teams.find(t => t.id === team).productLead = lead
    }
}

function makeTeamId(name, kind) {
    return `${name}_${kind}`.toLowerCase().replace(/[^a-z0-9]+/, '_')
}

function makeEmployeeId(name) {
    return `${name}`.toLowerCase().replace(/[^a-z0-9]+/, '_')
}

const data = new Organisation([],[])

if (process.env.NODE_ENV === "development") {
    const d = require("./fixtures/example.json")
    data.parseData(d)
}

export default data

export function _moveNodesToChildren(team, showMembers, showVacancies, notRecursive) {

    if (!notRecursive) {
        team.children = team.children.map(c => _moveNodesToChildren(c, showMembers, showVacancies))
    }

    if (showMembers) {
        team.children = team.children.concat(team.members)
    }

    if (showVacancies) {
        for (let stream in team.vacancies) {
            for (let n = 1; n <=team.vacancies[stream]; n++) {
                team.children.push({
                    name: `${stream}`,
                    kind: 'vacancy',
                    id: `vacancy_${team.id}_${stream}_${n}`
                })
            }
        }
        for (let stream in team.backfills) {
            for (let n = 1; n <=team.backfills[stream]; n++) {
                team.children.push({
                    name: `${stream}`,
                    kind: 'backfill',
                    id: `backfill_${team.id}_${stream}_${n}`
                })
            }
        }
    }

    return team
}

const findLeadUpFromFor = (team, teams, employee) => {

    let searchKey

    switch (employee.stream) {
        case STREAM.PRODUCT:
        case STREAM.DESIGN:
        case STREAM.DATA:
            searchKey = 'productLead'
            break;
        case STREAM.ENGINEERING:
        case STREAM.OPERATIONS:
            searchKey = 'techLead'
            break;
        default:
            searchKey = 'techLead'
    }

    let currentTeam = team

    if (currentTeam[searchKey]) {
        return currentTeam[searchKey]
    }

    while(currentTeam.parent && teams[currentTeam.parent]) {
        currentTeam = teams[currentTeam.parent]

        if (currentTeam[searchKey]) {
            return currentTeam[searchKey]
        }
    }

    return null
}

export const flattenTeamHierarchyExcluding = (teamId) => {
    function fn(r, a) {

        if (a.id === teamId) return r

        r.push(a);
        if (a.children && a.children.length > 0) {
            a.children.reduce(fn, r);
        }
        return r;
    }

    return fn
}
