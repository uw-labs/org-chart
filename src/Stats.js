import React from 'react'
import {Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import {flattenTeamHierarchyExcluding} from './state'

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
                <div><h3>Operations</h3><StackedBarChart teams={teamsFlat} operations/></div>
            </div>

        )
    }
}

function filterMembers({engineering, operations, portfolio, product}) {
    return member => {
        if (engineering && member.stream === 'ENGINEERING') {
            return true
        }
        if (operations && member.stream === 'OPERATIONS') {
            return true
        }
        if (portfolio && member.stream === 'PORTFOLIO') {
            return true
        }
        if (product && member.stream === 'PRODUCT') {
            return true
        }
        return false
    }
}

function countVacancies(vacancies, {engineering, operations, portfolio, product}) {

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
    if (isNaN(tally)) {
        console.log(tally, vacancies)
    }
    return tally
}

const StackedBarChart = ({teams, engineering, operations, portfolio, product, title}) => {

    const memberFilter = filterMembers({engineering, operations, portfolio, product})

    const data = teams.map(t => {
        const members = t.members.filter(memberFilter).length
        const vacancies = countVacancies(t.vacancies, {engineering, operations, portfolio, product})

        if (t.name === "Technology Department" || (!vacancies && !members)) {
            return null
        }

        return {name: t.name, members, vacancies}

    }).filter(f => !!f)

    return (
        <ResponsiveContainer width={"100%"} minHeight={200}>
            <BarChart data={data}>
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

    const streams = {
        ENGINEERING: {employees: 0, vacancies: 0},
        PRODUCT: {employees: 0, vacancies: 0},
        PORTFOLIO: {employees: 0, vacancies: 0},
        OPERATIONS: {employees: 0, vacancies: 0},
    }

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

    const data = [
        {stream: "engineering", ...streams.ENGINEERING},
        {stream: "portfolio", ...streams.PORTFOLIO},
        {stream: "product", ...streams.PRODUCT},
        {stream: "operations", ...streams.OPERATIONS}
    ]

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

