import React from 'react'

import viz from './d3/visualisation'
import {exportToSVG} from './d3/visualisation'
import partition from './d3/partition'

import {Box, Flex} from 'reflexbox'

import SaveIcon from 'material-ui/svg-icons/content/save'
import IconButton from 'material-ui/IconButton';

import FileSaver from 'file-saver';

class GraphHolder extends React.Component {


    shouldComponentUpdate() { return false }

    renderChart(employees) {

        while (this.refs.chart.firstChild) {
            this.refs.chart.removeChild(this.refs.chart.firstChild);
        }

        const preparedEmployees = employees

        const employeesPartition = partition(preparedEmployees)

        viz('reporting-chart', employeesPartition, 'reporting-chart')

    }

    componentWillReceiveProps(nextProps) {
        if (!this.props.reporting && !nextProps) {
            return
        }
        if(nextProps.reporting === this.props.reporting) {
            return
        }

        this.renderChart(nextProps.reporting.toJS())
    }

    componentDidMount() {
        if (!this.props.reporting) {
            return
        }

        this.renderChart(this.props.reporting.toJS())
    }

    render() {
        return (<div id="reporting-chart" ref="chart"></div>)
    }
}

export default class ReportingChart extends React.Component {

    constructor(props) {
        super(props)
        this.state = {

        }
    }

    render() {

        return (
            <div>
            <Flex p={0} align='center'>
                <Box pb={0} w={1 / 4} style={{alignSelf: "flex-start"}}>
                    <IconButton onClick={() => {
                        const blob = exportToSVG('reporting-chart')
                        FileSaver.saveAs(blob, 'reporting-structure.svg');
                    }}>
                        <SaveIcon />
                    </IconButton>
                </Box>
            </Flex>
            <GraphHolder reporting={this.props.data.get('reporting')}/>
            </div>
        )
    }
}