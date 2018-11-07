import React from 'react';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';

import AdminApp from './Admin'

import {fromJS} from 'immutable'

import {Tab, Tabs} from 'material-ui/Tabs';
import RaisedButton from 'material-ui/RaisedButton';
import TextField from 'material-ui/TextField';

import Team from './Team'
import Stats from './Stats'
import Leaders from './Leaders'
import Reporting from './Reporting'

export default class App extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            admin: fromJS({
                section: 'teams',
                data: props.data.toLiteral()
            })
        }
    }

    componentDidMount() {

        function getParameterByName(name) {
            var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
            return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
        }

        let url = getParameterByName('q')

        if (!url) {
            url = localStorage.getItem("dataURL")
        }

        if (url) {
            this.props.data.loadData(url).then(() => {
                this.bang()
                const shareURL = `${window.location.protocol}//${window.location.hostname}:${window.location.port}${window.location.pathname}?q=${encodeURIComponent(url)}`

                this.setState({url: shareURL})
            })
        }
    }

    bang = () => {
        const state = this.state.admin.set('data', fromJS(this.props.data.toLiteral()))
        this.setState({admin: state})
    }

    reparentTeam = (team, to) => {
        this.props.data.reparentTeam(team, to)
        this.bang()
    }

    addToTeam = (employee, to) => {
        this.props.data.addToTeam(employee, to)
        this.bang()
    }

    removeFromTeam = (employee) => {
        this.props.data.removeFromTeam(employee)
        this.bang()
    }

    exportData = () => {
        this.setState({exportData: this.props.data.toJSON()})
    }

    importData = () => {
        this.props.data.fromJSON(this.refs.importData.getValue())

        this.bang()
    }

    changeHeadcount = (team, stream, headcount) => {
        this.props.data.changeHeadcount(team, stream, headcount)
        this.bang()
    }

    addNewTeam = (name, kind, parent, description) => {
        this.props.data.addNewTeam(name, kind, parent, description)
        this.bang()
    }

    saveData = () => {

        let url = this.refs.dataURL.getValue()

        if (!url) {
            url = localStorage.getItem("persistURL")
        }

        if (url) {
            this.props.data.saveData(url).then(() => {
                this.bang()
                const shareURL = `${window.location.protocol}//${window.location.hostname}:${window.location.port}${window.location.pathname}?q=${encodeURIComponent(url)}`

                this.setState({url: shareURL})
            })
        } else {
            alert("Could not work out persistence URL")
        }


    }

    loadData = () => {

        const url = this.refs.dataURL.getValue()

        this.props.data.loadData(url).then(
            () => this.bang()
        )

				const shareURL = `${window.location.protocol}//${window.location.hostname}:${window.location.port}${window.location.pathname}?q=${encodeURIComponent(url)}`

				this.setState({url: shareURL})
    }

    removeTeam = (team) => {
        this.props.data.removeTeam(team)
        this.bang()
    }

    changeTeamName = (id, name) => {
        this.props.data.changeTeamName(id, name)
        this.bang()
    }

    changeTeamDescription = (id, description) => {
        this.props.data.changeTeamDescription(id, description)
        this.bang()
    }

    addEmployee = (name, title, stream, reportsTo, employee, github) => {
        this.props.data.addEmployee(name, title, stream, reportsTo, employee, github)
        this.bang()
    }

    editEmployee = (id, name, title, stream, reportsTo, employee, github) => {
        this.props.data.editEmployee(id, name, title, stream, reportsTo, employee, github)
        this.bang()
    }

    setTechLead = (team, lead) => {
        this.props.data.setTechLead(team, lead)
        this.bang()
    }

    setProductLead = (team, lead) => {
        this.props.data.setProductLead(team, lead)
        this.bang()
    }

    render() {

        return (
            <MuiThemeProvider>
                <Tabs initialSelectedIndex={0}>
                    <Tab label="Team Chart">
                        <Team data={this.state.admin.get('data')}></Team>
                    </Tab>
                    <Tab label="Reporting Chart">
                        <Reporting data={this.state.admin.get('data')}></Reporting>
                    </Tab>
                    <Tab label="Leaders">
                        <Leaders data={this.state.admin.get('data')}></Leaders>
                    </Tab>
                    <Tab label="Manage">
                        <AdminApp section={this.state.admin.get('section')} data={this.state.admin.get('data')}
                                  actions={{
                                      reparentTeam: this.reparentTeam,
                                      addToTeam: this.addToTeam,
                                      removeFromTeam: this.removeFromTeam,
                                      changeHeadcount: this.changeHeadcount,
                                      addNewTeam: this.addNewTeam,
                                      changeTeamName: this.changeTeamName,
                                      changeTeamDescription: this.changeTeamDescription,
                                      removeTeam: this.removeTeam,
                                      addEmployee: this.addEmployee,
                                      editEmployee: this.editEmployee,
                                      setTechLead: this.setTechLead,
                                      setProductLead: this.setProductLead,
                                  }}/>
                    </Tab>
                    <Tab label="STATS">
                        <Stats data={this.state.admin.get('data')}/>
                    </Tab>
                    <Tab label="DATA">
                        <div>
                            <br/><br/>
                            <TextField
                                floatingLabelText="Share URL"
                                fullWidth={true}
                                textareaStyle={{fontFamily: "monospace", fontSize: "0.5em", lineHeight: "0.75em"}}
                                value={this.state.url ? this.state.url :""}
                            />
                            <br/><br/>
                            <TextField
                                floatingLabelText="Data URL"
                                fullWidth={true}
                                textareaStyle={{fontFamily: "monospace", fontSize: "0.5em", lineHeight: "0.75em"}}
                                ref={"dataURL"}
                            />
                            <RaisedButton fullWidth={true} label={"LOAD"} onClick={this.loadData}/>
                            <br/><br/>
                            <RaisedButton fullWidth={true} label={"SAVE"} onClick={this.saveData}/>
                            <br/><br/>
                            <TextField
                                floatingLabelText="Exported Data"
                                multiLine={true}
                                rows={4}
                                rowsMax={4}
                                fullWidth={true}
                                value={this.state.exportData}
                                textareaStyle={{fontFamily: "monospace", fontSize: "0.5em", lineHeight: "0.75em"}}
                            />
                            <RaisedButton fullWidth={true} label={"EXPORT"} onClick={this.exportData}/>
                            <br/><br/>
                            <TextField
                                floatingLabelText="Import Data"
                                multiLine={true}
                                rows={4}
                                rowsMax={4}
                                fullWidth={true}
                                textareaStyle={{fontFamily: "monospace", fontSize: "0.5em", lineHeight: "0.75em"}}
                                ref={"importData"}
                            />
                            <RaisedButton fullWidth={true} label={"IMPORT"} onClick={this.importData}/>
                        </div>
                    </Tab>

                </Tabs>
            </MuiThemeProvider>
        )
    }
}

