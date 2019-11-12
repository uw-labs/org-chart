import React from 'react'

import Toggle from 'material-ui/Toggle';

import viz from './d3/visualisation'
import {exportToSVG} from './d3/visualisation'
import partition from './d3/partition'

import {Box, Flex} from 'reflexbox'

import {_moveNodesToChildren } from './state'

import SaveIcon from 'material-ui/svg-icons/content/save'
import IconButton from 'material-ui/IconButton';

import FileSaver from 'file-saver';

class GraphHolder extends React.Component {


    shouldComponentUpdate() { return false }

    renderChart(teams, showMembers, showVacancies) {

        while (this.refs.chart.firstChild) {
            this.refs.chart.removeChild(this.refs.chart.firstChild);
        }

        const preparedTeams = _moveNodesToChildren(teams, showMembers, showVacancies)

        const teamsPartition = partition(preparedTeams)

        viz('chart', teamsPartition, 'team-chart')

    }

    componentWillReceiveProps(nextProps) {
        if (!this.props.teams && !nextProps) {
            return
        }
        if(nextProps.teams === this.props.teams && nextProps.members === this.props.members && nextProps.vacancies === this.props.vacancies) {
            return
        }

        this.renderChart(nextProps.teams.toJS(), nextProps.members, nextProps.vacancies)
    }

    componentDidMount() {
        if (!this.props.teams) {
            return
        }
        this.renderChart(this.props.teams.toJS(), this.props.members, this.props.vacancies)
    }

    render() {
        return (<div id="chart" ref="chart"></div>)
    }
}

export default class TeamChart extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            showVacancies: true,
            showMembers: true
        }
    }

    toggleMembers = (_, showMembers) => {
        this.setState({showMembers})
    }

    toggleVacancies = (_, showVacancies) => {
        this.setState({showVacancies})
    }

    render() {

        return (
            <div>
            <Flex p={0} align='center'>
                <Box pb={0} w={1 / 4} style={{alignSelf: "flex-start"}}>
                    <Toggle
                        label="show members"
                        style={{width: "15vw"}}
                        toggled={this.state.showMembers}
                        ref="showMembers"
                        onToggle={this.toggleMembers}
                    />
                </Box>
                <Box pb={0} w={1 / 4} style={{alignSelf: "flex-start"}}>
                    <Toggle
                        label="show vacancies"
                        style={{width: "15vw"}}
                        toggled={this.state.showVacancies}
                        ref="showVacancies"
                        onToggle={this.toggleVacancies}
                    />
                </Box>
                <Box pb={0} w={1 / 4} style={{alignSelf: "flex-start"}}>
                    <IconButton onClick={() => {
                        const blob = exportToSVG('chart')
                        FileSaver.saveAs(blob, 'team-structure.svg');
                    }}>
                        <SaveIcon />
                    </IconButton>
                </Box>
            </Flex>
            <GraphHolder teams={this.props.data.get('teams')} members={this.state.showMembers} vacancies={this.state.showVacancies}/>
            </div>
        )
    }
}
