import React from 'react'

import {
    Table,
    TableBody,
    TableHeader,
    TableHeaderColumn,
    TableRow,
    TableRowColumn,
} from 'material-ui/Table'
import {STREAM} from "./state";

function flattenTeamsFn(parents = []) {
    return function flattenTeams(r, a) {
        a.parents = parents.slice();
        r.push(a);
        const newParents = parents.slice()
        newParents.push(a.name)
        if (a.children && a.children.length > 0) {
            a.children.reduce(flattenTeamsFn(newParents), r);
        }
        return r;
    }
}

function findLeadNameUpwards(team, byId, stream) {
    if (team[stream]) {
        return team[stream].name
    }

    let current = team.parent

    while(current) {

        if (!byId[current]) return ""

        if (byId[current][stream]) {
            return byId[current][stream].name
        }
        current = byId[current].parent
    }

    return ""
}



export default class Leaders extends React.Component {

    render() {

        const teams = this.props.data.get('teams')

        if (!teams) return null

        const flatten = [teams.toJS()].reduce(flattenTeamsFn(), [])

        const byId = flatten.reduce((teams, team) => {
            teams[team.id] = team
            return teams
        }, {})

        return (
            <div>
                <Table selectable={false}>
                    <TableHeader adjustForCheckbox={false} enableSelectAll={false} displaySelectAll={false}>
                        <TableRow>
                            <TableHeaderColumn>Team</TableHeaderColumn>
                            {Object.keys(STREAM).map(val => (
                                <TableHeaderColumn>{val.charAt(0).toUpperCase()+val.slice(1).toLowerCase().replace("_", " ")} Lead</TableHeaderColumn>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody displayRowCheckbox={false}>
                            {flatten.map(t => (
                                <TableRow key={`${t.id}`}>
                                    <TableRowColumn key={`${t.id}`} style={{paddingLeft: `${20*t.parents.length+20}px`}}>
                                        {t.name}
                                    </TableRowColumn>
                                    {Object.keys(STREAM).map(val => (
                                        <TableRowColumn style={{opacity: t[val.toLowerCase()+"Lead"] ? 1 : 0.5}} key={`${val}${t.id}`}>{findLeadNameUpwards(t, byId, val.toLowerCase()+"Lead")}</TableRowColumn>
                                    ))}
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </div>
        )
    }
}