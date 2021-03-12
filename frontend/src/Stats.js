import React from 'react'
import {Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import {List, ListItem} from 'material-ui/List'

import {STREAM, flattenTeamHierarchyExcluding} from './state'


export default class Stats extends React.Component {
    render() {

        if (!this.props.data.get("teams")) {
            return null
        }

        const team = this.props.data.get("teams").toJS();

        const employees = this.props.data.get("employees").toJS();

        const teamsById = this.props.data.get("teamsById").toJS();

        const teamsFlat = [team].reduce(flattenTeamHierarchyExcluding(), [])

        return (
            <div>
                <div><h3>New Starters</h3><StartDateList employees={employees} teams={teamsById}/></div>
                <div><h3>Contractors</h3><NonEmployees employees={employees} teams={teamsById}/></div>
                <div><h3>Totals</h3><TwoLevelPieChart teams={teamsFlat}/></div>
                {Object.keys(STREAM).map(val => (
                    <div key={"stats_for_"+val}><h3>{val}</h3><StackedBarChart teams={teamsFlat} stream={val} title={val}/></div>
                ))}
            </div>

        )
    }
}

function filterMembers(stream) {
    return member => {
        if (member.stream === stream) {
            return true
        }
        return false
    }
}

function countVacancies(vacancies, stream) {

    let tally = 0

    if (!vacancies) {
        return tally
    }

    if (vacancies[stream]) {
        tally += vacancies[stream]
    }

    if (isNaN(tally)) {
        console.log(tally, vacancies)
    }
    return tally
}

const StackedBarChart = ({teams, stream, title}) => {

    const memberFilter = filterMembers(stream)

    const datas = teams.map(t => {
        const members = t.members.filter(memberFilter).length
        const vacancies = countVacancies(t.vacancies, stream)
        const backfills = countVacancies(t.backfills, stream)

        if (t.name === "Technology Department" || (!vacancies && !members)) {
            return null
        }

        return {name: t.name, members, vacancies, backfills}

    }).filter(f => !!f)

    return (
        <ResponsiveContainer width={"100%"} minHeight={200}>
            <BarChart data={datas}>
                <XAxis dataKey="name"></XAxis>
                <YAxis/>
                <CartesianGrid/>
                <Tooltip/>
                <Legend/>
                <Bar dataKey="members" stackId="a" fill="#00ccc8"/>
                <Bar dataKey="vacancies" stackId="a" fill="#f5aa3c"/>
                <Bar dataKey="backfills" stackId="a" fill="#ea73ea"/>
            </BarChart>
        </ResponsiveContainer>
    )
}

const TwoLevelPieChart = ({teams}) => {

    const streams = {}

    Object.keys(STREAM).forEach(st => {
        streams[st] = {employees: 0, vacancies: 0, backfills: 0}
    })

    let max = 0

    teams.forEach(t => {
        t.members.forEach(m => {
            streams[m.stream].employees += 1
            max = max < streams[m.stream].employees ? streams[m.stream].employees : max
        })

        Object.keys(t.vacancies).forEach(st => {
            streams[st].vacancies += t.vacancies[st]
        })

        Object.keys(t.backfills).forEach(st => {
            streams[st].backfills += t.backfills[st]
        })
    })

    const data = []

    Object.keys(streams).forEach(st => {
        data.push({stream: st, ...streams[st]})
    })

    return (
        <ResponsiveContainer width={"100%"} minHeight={200}>
            <BarChart data={data}>
                <XAxis dataKey="stream"/>
                <YAxis/>
                <CartesianGrid/>
                <Tooltip/>
                <Legend/>
                <Bar dataKey="employees" stackId="a" fill="#00ccc8"/>
                <Bar dataKey="vacancies" stackId="a" fill="#f5aa3c"/>
                <Bar dataKey="backfills" stackId="a" fill="#ea73ea"/>
            </BarChart>
        </ResponsiveContainer>

    )
}

const StartDateList = ({employees, teams}) => {
    return (
        <List>
            {employees.filter(e => e.startDate).map(e => (
                <ListItem key={e.id} primaryText={`${e.name} - ${e.memberOf ? teams[e.memberOf].name : 'Unassigned'}`} secondaryText={e.startDate} />
            ))}
        </List>
    )
}

const NonEmployees = ({employees, teams}) => {
    return (
        <List>
            {employees.filter(e => e.type !== "EMPLOYEE").map(e => (
                <ListItem key={e.id} primaryText={`${e.name} - ${e.memberOf ? teams[e.memberOf].name : 'Unassigned'}`} secondaryText={e.type} />
            ))}
        </List>
    )
}

