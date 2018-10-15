import React from 'react'

import {Box, Flex} from 'reflexbox'
import {List, ListItem} from 'material-ui/List'
import Subheader from 'material-ui/Subheader';
import SelectField from 'material-ui/SelectField';
import MenuItem from 'material-ui/MenuItem';
import TextField from 'material-ui/TextField';
import Checkbox from 'material-ui/Checkbox';
import {RadioButton, RadioButtonGroup} from 'material-ui/RadioButton';
import RaisedButtom from 'material-ui/RaisedButton'
import FlatButton from 'material-ui/FlatButton'
import Dialog from 'material-ui/Dialog';
import IconButton from 'material-ui/IconButton';
import EditIcon from 'material-ui/svg-icons/editor/mode-edit';

import {flattenTeamHierarchyExcluding, KIND, STREAM} from './state'


function debounce(func, wait, immediate) {
    var timeout;
    return function () {
        var context = this, args = arguments;
        var later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

export default class Admin extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            team: null
        }
    }

    componentWillReceiveProps(props) {
        if (!this.state.team) {
            return
        }

        const teams = [props.data.get('teams').toJS()].reduce(flattenTeamHierarchyExcluding(), [])

        this.setState({team: teams.find(t => t.id === this.state.team.id)})
    }

    render() {

        if (!this.props.data.get('teams')) {
            return null
        }

        return (
            <Flex p={0} align='center'>
                <Box pb={0} w={1 / 3} style={{alignSelf: "flex-start"}}>
                    <TeamManager team={this.props.data.get('teams').toJS()} onSelect={(team) => {
                        this.setState({
                            team
                        })
                    }} addNewTeam={this.props.actions.addNewTeam}/>
                </Box>
                <Box pb={0} w={1 / 3} style={{alignSelf: "flex-start"}}>
                    <TeamDetails root={this.props.data.get('teams').toJS()} team={this.state.team}
                                 {...this.props.actions}
                                 employees={this.props.data.get('employees').toJS()}
                    />
                </Box>
                <Box pb={0} w={1 / 3} style={{alignSelf: "flex-start", maxHeight: "90vh", overflow: "auto"}}>
                    <EmployeeList
                        employees={this.props.data.get('employees').toJS()}
                        exclude={this.state.team ? this.state.team.id : null} addToTeam={(employee) => {
                            this.props.actions.addToTeam(employee, this.state.team.id)
                        }}
                        teams={[this.props.data.get('teams').toJS()].reduce(flattenTeamHierarchyExcluding(), [])}
                        addEmployee={this.props.actions.addEmployee}
                        editEmployee={this.props.actions.editEmployee}
                    />
                </Box>
            </Flex>
        )
    }
}


function collectUpstreamEmployees(collection, team) {

    if (team.members) {
        collection = collection.concat(team.members);
    }

    if (team.parent) {
        collection = collectUpstreamEmployees(collection, team.parent)
    }

    return collection
}


class TeamDetails extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            name: ""
        }

        this.debouncedChangeTeamName = debounce(props.changeTeamName, 500, false)
        this.debouncedChangeTeamDescription = debounce(props.changeTeamDescription, 500, false)
    }

    componentWillReceiveProps(props) {
        this.setState({
            name: props.team ? props.team.name : "",
            description: props.team && props.team.description ? props.team.description : ""
        })
    }

    onNameChange = (id, val) => {
        this.setState({
            name: val
        })

        this.debouncedChangeTeamName(id, val)
    }

    onDescriptionChange = (id, val) => {
        this.setState({
            description: val
        })

        this.debouncedChangeTeamDescription(id, val)
    }

    render() {
        let {root, team, reparentTeam, removeFromTeam, changeHeadcount, removeTeam, employees, setProductLead, setTechLead} = this.props

        if (!team) {
            return null
        }

        let upstreamEmlpoyeesStreams = [...new Set(collectUpstreamEmployees([], team).map(e => e.stream))].sort()

        if (upstreamEmlpoyeesStreams.indexOf(STREAM.PORTFOLIO) !== -1) {
            upstreamEmlpoyeesStreams = [STREAM.PORTFOLIO]
        } else if (upstreamEmlpoyeesStreams.indexOf(STREAM.OPERATIONS) !== -1) {
            upstreamEmlpoyeesStreams = [STREAM.OPERATIONS]
        } else {
            upstreamEmlpoyeesStreams = [STREAM.ENGINEERING, STREAM.PRODUCT]
        }

        return (

            <div>
                <TextField
                    value={this.state.name}
                    floatingLabelText={"Name"}
                    fullWidth={true}
                    onChange={(_, val) => {
                        this.onNameChange(team.id, val)
                    }}
                />


                <SelectField
                    floatingLabelText="Member of"
                    fullWidth={true}
                    value={team.parent}
                    onChange={(_, __, i) => reparentTeam(team.id, i)}
                >
                    {[root].reduce(flattenTeamHierarchyExcluding(team.id), []).map(t => (
                        <MenuItem key={t.id} value={t.id} primaryText={t.name}/>
                    ))}
                </SelectField>
                <Flex p={0}>
                    {[...new Set(Object.keys(team.vacancies).concat(upstreamEmlpoyeesStreams))].map(s => (
                        <Box pb={0} w={1 / 3} style={{alignSelf: "flex-start"}} key={`vacancies_${s}`}>
                            <TextField onChange={(_, val) => changeHeadcount(team.id, s, val)}
                                       floatingLabelText={s.toLowerCase()}
                                       value={team.vacancies[s] !== undefined ? team.vacancies[s] : ""}/>
                        </Box>
                    ))}
                </Flex>


                <SelectField
                    floatingLabelText="Tech lead"
                    fullWidth={true}
                    value={team.techLead ? team.techLead.id : null}
                    onChange={(_, __, i) => setTechLead(team.id, i)}
                >
                    <MenuItem value={null} primaryText="" />
                    {employees.map(t => (
                        <MenuItem key={t.id} value={t.id} primaryText={t.name}/>
                    ))}
                </SelectField>

                <SelectField
                    floatingLabelText="Product lead"
                    fullWidth={true}
                    value={team.productLead ? team.productLead.id : null}
                    onChange={(_, __, i) => setProductLead(team.id, i)}
                >
                    <MenuItem value={null} primaryText="" />
                    {employees.filter(e => e.stream === STREAM.PRODUCT).map(t => (
                        <MenuItem key={t.id} value={t.id} primaryText={t.name}/>
                    ))}
                </SelectField>

                <Subheader>Members</Subheader>
                <List>

                    {team.members.map(e => (
                        <ListItem onClick={() => removeFromTeam(e.id)} primaryText={e.name} key={e.id}
                                  secondaryText={e.title}/>
                    ))}
                </List>
                <TextField
                    value={this.state.description}
                    floatingLabelText={"Description"}
                    fullWidth={true}
                    multiLine={true}
                    rowsMax={6}
                    rows={3}
                    onChange={(_, val) => {
                        this.onDescriptionChange(team.id, val)
                    }}
                />
                <RaisedButtom fullWidth={true} label={"Delete"} secondary onClick={() => {
                    if (!window.confirm("Ya?\nAll employees who are part of this team will be unassigned.\nAll child teams will be assigned to parent.")) {
                        return
                    }
                    removeTeam(team.id)
                }}/>
            </div>
        )
    }
}

const TeamManager = ({team, onSelect, addNewTeam}) => (
    <List>
        <ListItem onClick={() => onSelect(team)} primaryTogglesNestedList={false} initiallyOpen={true}
                  primaryText={team.name} key={team.id}
                  nestedItems={renderTeams(team.children, onSelect)}/>
        <ListItem>
            <AddTeamDialog parents={[team].reduce(flattenTeamHierarchyExcluding(), [])} addNewTeam={addNewTeam}/>
        </ListItem>
    </List>
)

const renderTeams = (teams, onSelect) => {
    if (!teams) {
        return null
    }
    return teams.map(t => (
        <ListItem onClick={() => onSelect(t)} primaryTogglesNestedList={true} primaryText={t.name} key={t.id}
                  nestedItems={renderTeams(t.children, onSelect)}/>
    ))
}

class EmployeeList extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            search: "",
            filter: false,
            addPersonOpen: false,
            editedPerson: null
        }
    }

    handleSearchChange = (event) => {
        this.setState({
            search: event.target.value,
        });
    };

    handleFilterChange = (_, isInputChecked) => {
        this.setState({
            filter: isInputChecked,
        });
    };


    render() {
        const {employees, exclude, addToTeam, teams} = this.props
        return (
            <div>
                <List style={{maxHeight: '100%', overflow: 'auto'}}>
                    <ListItem>
                        <RaisedButtom label={"Add"} fullWidth={true} onClick={() => {
                            this.setState({addPersonOpen: true, editedPerson: null})
                        }}/>
                        <TextField
                            fullWidth={true}
                            hintText="Search"
                            value={this.state.search}
                            onChange={this.handleSearchChange}
                        />
                        <Checkbox
                            label="unassigned only"
                            onCheck={this.handleFilterChange}
                        />
                    </ListItem>
                    {employees.filter(e => {
                        return e.memberOf !== exclude &&
                            e.name.toLowerCase().search(this.state.search.toLowerCase()) !== -1 &&
                            (!this.state.filter || !e.memberOf)
                    }).map(e => {
                        const team = teams.find(t => t.id === e.memberOf)

                        let sub = e.title

                        if (e.github) {
                            sub = `${sub} [gh: ${e.github}]`
                        }

                        if (team) {
                            sub = `${sub} - ${team.name}`
                        }
                        return (<ListItem primaryText={e.name + ` #${e.number}`} key={e.id} onClick={() => exclude && addToTeam(e.id)}
                                          secondaryText={sub}
                                          rightIconButton={<IconButton tooltip="edit" onClick={() => {
                                              this.setState({addPersonOpen: true, editedPerson: e})
                                          }}><EditIcon/></IconButton>}/>)
                    })}
                </List>
                <AddPersonDialog open={this.state.addPersonOpen} person={this.state.editedPerson} afterClose={() => {
                    this.setState({addPersonOpen: false, editedPerson: null} )
                }} addEmployee={this.props.addEmployee} editEmployee={this.props.editEmployee} employees={employees} />
            </div>
        )
    }
}

class AddPersonDialog extends React.Component {

    state = {
        open: false,
        id: null,
        name: "",
        title: "",
        stream: STREAM.ENGINEERING,
        reportsTo: null,
        github: "",
        number: ""
    }

    componentWillReceiveProps(nextProps) {
        if (this.props === nextProps) {
            return
        }

        this.setState({
            open: nextProps.open,
            id: null,
            name: "",
            title: "",
            github: "",
            number: "",
            stream: STREAM.ENGINEERING,
            ...nextProps.person,
            reportsTo: null,
        })
    }

    handleClose = () => {
        //this.setState({open: false});
        this.props.afterClose()
    };

    submit = () => {
        const {id, name, title, stream, reportsTo, number, github} = this.state

        if (!name || !title || !stream) {
            return
        }

        if (id) {
            this.props.editEmployee(id, name, title, stream, reportsTo, number, github);
        } else {
            this.props.addEmployee(name, title, stream, reportsTo, number, github);
        }

        this.handleClose()
    }

    render() {
        const actions = [
            <FlatButton
                label="Cancel"
                primary={true}
                onClick={this.handleClose}
            />,
            <RaisedButtom
                label="Submit"
                primary={true}
                onClick={this.submit}
            />,
        ];

        return (
            <Dialog
                title={this.props.person ? "Edit Employee" : "Add New Employee"}
                actions={actions}
                modal={false}
                open={this.state.open}
                onRequestClose={this.handleClose}
            >

                <TextField floatingLabelText={"Full Name"} onChange={(_, val) => {
                    this.setState({name: val})
                }} value={this.state.name}/><br/>

                <TextField floatingLabelText={"Title"} onChange={(_, val) => {
                    this.setState({title: val})
                }} value={this.state.title}/><br/>

                <TextField floatingLabelText={"GitHub"} onChange={(_, val) => {
                    this.setState({github: val})
                }} value={this.state.github}/><br/>

                <TextField floatingLabelText={"Employee #"} onChange={(_, val) => {
                    this.setState({number: val})
                }} value={this.state.number}/><br/>

                <RadioButtonGroup name="stream" onChange={(_, val) => {
                    this.setState({stream: val})
                }} labelPosition={"right"} valueSelected={this.state.stream}>
                    <RadioButton
                        value={STREAM.ENGINEERING}
                        label={STREAM.ENGINEERING}
                    />
                    <RadioButton
                        value={STREAM.PRODUCT}
                        label={STREAM.PRODUCT}
                    />
                    <RadioButton
                        value={STREAM.OPERATIONS}
                        label={STREAM.OPERATIONS}
                    />
                    <RadioButton
                        value={STREAM.PORTFOLIO}
                        label={STREAM.PORTFOLIO}
                    />
                </RadioButtonGroup>

                <SelectField
                    onChange={(_, __, val) => {
                        this.setState({reportsTo: val})
                    }}
                    fullWidth={true}
                    value={this.state.reportsTo}
                    floatingLabelText={"Reports to"}
                >
                    {this.props.employees.map(t => (
                        <MenuItem key={t.id} value={t.id} primaryText={t.name}/>
                    ))}
                </SelectField>

            </Dialog>
        )
    }
}

class AddTeamDialog extends React.Component {
    state = {
        open: false,
        name: "",
        kind: KIND.SQUAD,
        parent: ""
    };

    handleOpen = () => {
        this.setState({open: true, name: "", kind: KIND.SQUAD, parent: "", description: ""});
    };

    handleClose = () => {
        this.setState({open: false});
    };

    submit = () => {
        const {name, kind, parent, description} = this.state

        if (!name || !kind || !parent || !description) {
            return
        }

        this.props.addNewTeam(name, kind, parent, description);

        this.setState({open: false})
    }

    render() {
        const actions = [
            <FlatButton
                label="Cancel"
                primary={true}
                onClick={this.handleClose}
            />,
            <RaisedButtom
                label="Submit"
                primary={true}
                onClick={this.submit}
            />,
        ];

        return (
            <div>
                <RaisedButtom label={"Add"} fullWidth={true} onClick={this.handleOpen}/>
                <Dialog
                    title="Add New Team"
                    actions={actions}
                    modal={false}
                    open={this.state.open}
                    onRequestClose={this.handleClose}
                >
                    <TextField floatingLabelText={"Team name"} onChange={(_, val) => {
                        this.setState({name: val})
                    }} value={this.state.name}/>
                    <RadioButtonGroup name="kind" onChange={(_, val) => {
                        this.setState({kind: val})
                    }} labelPosition={"right"} valueSelected={this.state.kind}>
                        <RadioButton
                            value={KIND.SQUAD}
                            label={KIND.SQUAD}
                        />
                        <RadioButton
                            value={KIND.TRIBE}
                            label={KIND.TRIBE}
                        />
                        <RadioButton
                            value={KIND.TEAM}
                            label={KIND.TEAM}
                        />
                        <RadioButton
                            value={KIND.UNIT}
                            label={KIND.UNIT}
                        />
                    </RadioButtonGroup>
                    <SelectField
                        onChange={(_, __, val) => {
                            this.setState({parent: val})
                        }}
                        fullWidth={true}
                        value={this.state.parent}
                        floatingLabelText={"Member of"}
                    >
                        {this.props.parents.map(t => (
                            <MenuItem key={t.id} value={t.id} primaryText={t.name}/>
                        ))}
                    </SelectField>
                    <TextField floatingLabelText={"Description"} multiLine={true} rowsMax={6} rows={4}
                        onChange={(_, val) => {
                        this.setState({description: val})
                    }} value={this.state.description}/>
                </Dialog>
            </div>
        );
    }
}