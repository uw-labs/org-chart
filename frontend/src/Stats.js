import React from 'react'
import {Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import {STREAM, flattenTeamHierarchyExcluding} from './state'

export default class Stats extends React.Component {
    render() {

        if (!this.props.data.get("teams")) {
            return null
        }

        const team = this.props.data.get("teams").toJS();

        const teamsFlat = [team].reduce(flattenTeamHierarchyExcluding(), [])

        return (
            <div>
                <div><h3>Totals</h3><TwoLevelPieChart teams={teamsFlat}/></div>
                <div><h3>Engineering</h3><StackedBarChart teams={teamsFlat} engineering title={"Engineering"}/></div>
                <div><h3>Product</h3><StackedBarChart teams={teamsFlat} product/></div>
                <div><h3>Design</h3><StackedBarChart teams={teamsFlat} design/></div>
                <div><h3>Data</h3><StackedBarChart teams={teamsFlat} data/></div>
                <div><h3>Operations</h3><StackedBarChart teams={teamsFlat} operations/></div>
            </div>

        )
    }
}

function filterMembers({engineering, operations, portfolio, product, data, design}) {
    return member => {
        if (engineering && member.stream === STREAM.ENGINEERING) {
            return true
        }
        if (operations && member.stream === STREAM.OPERATIONS) {
            return true
        }
        if (portfolio && member.stream === STREAM.PORTFOLIO) {
            return true
        }
        if (product && member.stream === STREAM.PRODUCT) {
            return true
        }
        if (data && member.stream === STREAM.DATA) {
            return true
        }
        if (design && member.stream === STREAM.DESIGN) {
            return true
        }
        return false
    }
}

function countVacancies(vacancies, {engineering, operations, portfolio, product, data, design}) {

    let tally = 0

    if (!vacancies) {
        return tally
    }

    if (engineering && vacancies['ENGINEERING']) {
        tally += vacancies['ENGINEERING']
    }
    if (operations && vacancies['OPERATIONS']) {
        tally += vacancies['OPERATIONS']
    }
    if (portfolio && vacancies['PORTFOLIO']) {
        tally += vacancies['PORTFOLIO']
    }
    if (product && vacancies['PRODUCT']) {
        tally += vacancies['PRODUCT']
    }
    if (data && vacancies['DATA']) {
        tally += vacancies['DATA']
    }
    if (design && vacancies['DESIGN']) {
        tally += vacancies['DESIGN']
    }
    if (isNaN(tally)) {
        console.log(tally, vacancies)
    }
    return tally
}

const StackedBarChart = ({teams, engineering, operations, portfolio, product, data, design, title}) => {

    const memberFilter = filterMembers({engineering, operations, portfolio, product, data, design})

    const datas = teams.map(t => {
        const members = t.members.filter(memberFilter).length
        const vacancies = countVacancies(t.vacancies, {engineering, operations, portfolio, product, data, design})

        if (t.name === "Technology Department" || (!vacancies && !members)) {
            return null
        }

        return {name: t.name, members, vacancies}

    }).filter(f => !!f)

    return (
        <ResponsiveContainer width={"100%"} minHeight={200}>
            <BarChart data={datas}>
                <XAxis dataKey="name"></XAxis>
                <YAxis/>
                <CartesianGrid/>
                <Tooltip/>
                <Legend/>
                <Bar dataKey="members" stackId="a" fill="#00B4CE"/>
                <Bar dataKey="vacancies" stackId="a" fill="#00ccc8"/>
            </BarChart>
        </ResponsiveContainer>
    )
}

const TwoLevelPieChart = ({teams}) => {

    const streams = {}

    Object.keys(STREAM).forEach(st => {
        streams[st] = {employees: 0, vacancies: 0}
    })

    let max = 0

    teams.forEach(t => {
        t.members.forEach(m => {
            streams[m.stream].employees += 1
            max = max < streams[m.stream].employees ? streams[m.stream].employees : max
        })
    })

    teams.forEach(t => {
        Object.keys(t.vacancies).forEach(st => {
            streams[st].vacancies += t.vacancies[st]
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
                <Bar dataKey="employees" stackId="a" fill="#00B4CE"/>
                <Bar dataKey="vacancies" stackId="a" fill="#00ccc8"/>
            </BarChart>
        </ResponsiveContainer>

    )
}

