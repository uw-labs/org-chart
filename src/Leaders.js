import React from 'react'

import {
    Table,
    TableBody,
    TableHeader,
    TableHeaderColumn,
    TableRow,
    TableRowColumn,
} from 'material-ui/Table'

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

function findProductLeadNameUpwards(team, byId) {
    if (team.productLead) {
        return team.productLead.name
    }

    let current = team.parent

    while(current) {

        if (!byId[current]) return ""

        if (byId[current].productLead) {
            return byId[current].productLead.name
        }
        current = byId[current].parent
    }

    return ""
}

function findTechLeadNameUpwards(team, byId) {
    if (team.techLead) {
        return team.techLead.name
    }

    let current = team.parent

    while(current) {

        if (!byId[current]) return ""

        if (byId[current].techLead) {
            return byId[current].techLead.name
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
                            <TableHeaderColumn>Tech Lead</TableHeaderColumn>
                            <TableHeaderColumn>Product Lead</TableHeaderColumn>
                        </TableRow>
                    </TableHeader>
                    <TableBody displayRowCheckbox={false}>
                            {flatten.map(t => (
                                <TableRow key={`${t.id}`}>
                                    <TableRowColumn key={`${t.id}`} style={{paddingLeft: `${20*t.parents.length+20}px`}}>
                                        {t.name}
                                    </TableRowColumn>
                                    <TableRowColumn style={{opacity: t.techLead ? 1 : 0.5}} key={`tlead_${t.id}`}>{findTechLeadNameUpwards(t, byId)}</TableRowColumn>
                                    <TableRowColumn style={{opacity: t.productLead ? 1 : 0.5}} key={`plead_${t.id}`}>{findProductLeadNameUpwards(t, byId)}</TableRowColumn>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </div>
        )
    }
}