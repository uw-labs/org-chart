package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/jszwec/csvutil"

	"google.golang.org/api/googleapi"

	"google.golang.org/api/option"

	"cloud.google.com/go/bigquery"
	"github.com/google/go-querystring/query"

	"golang.org/x/oauth2"

	couch "github.com/lancecarlson/couchgo"
	"github.com/sirupsen/logrus"
	"github.com/urfave/cli"

	"github.com/google/go-github/github"
	"github.com/pkg/errors"
)

const ROOT_EMPLOYEE = "damon_petta"

func main() {

	app := cli.NewApp()

	app.Name = "org-chart management"

	app.Commands = []cli.Command{
		{
			Name: "bq-import",
			Flags: []cli.Flag{
				cli.StringFlag{
					Name: "data-url",
				},
				cli.StringFlag{
					Name: "bq-project-id",
				},
				cli.StringFlag{
					Name: "bq-credentials-file",
				},
			},
			Action: func(c *cli.Context) error {

				ctx := context.Background()
				client, err := bigquery.NewClient(
					ctx,
					c.String("bq-project-id"),
					option.WithCredentialsFile(c.String("bq-credentials-file")),
				)
				if err != nil {
					return errors.Wrap(err, "creating google client")
				}

				dataset := client.Dataset("org_chart")

				err = dataset.Create(ctx, &bigquery.DatasetMetadata{
					Name:        "Org Chart",
					Description: "holds IT org chart exports",
					Location:    "eu",
				})

				if err != nil {
					if e, ok := err.(*googleapi.Error); ok && e.Code == http.StatusConflict {
						// already exists
					} else {
						return errors.Wrap(err, "creating dataset")
					}
				}

				employeesTable := dataset.Table("employees")
				teamsTable := dataset.Table("teams")
				vacanciesTable := dataset.Table("vacancies")

				employeesSchema, err := bigquery.InferSchema(EmployeeExport{})

				if err != nil {
					return errors.Wrap(err, "inferring employee schema")
				}

				err = employeesTable.Create(ctx, &bigquery.TableMetadata{
					Name:                   "Employees",
					Description:            "holds time partitioned export of Tech employees",
					TimePartitioning:       &bigquery.TimePartitioning{},
					RequirePartitionFilter: false,
					Schema:                 employeesSchema,
				})

				if err != nil {
					if err != nil {
						if e, ok := err.(*googleapi.Error); ok && e.Code == http.StatusConflict {
							// already exists
						} else {
							return errors.Wrap(err, "creating employees table")
						}
					}
				}

				teamsSchema, err := bigquery.InferSchema(TeamExport{})

				if err != nil {
					return errors.Wrap(err, "inferring teams schema")
				}

				err = teamsTable.Create(ctx, &bigquery.TableMetadata{
					Name:                   "Teams",
					Description:            "holds time partitioned export of Tech teams",
					TimePartitioning:       &bigquery.TimePartitioning{},
					RequirePartitionFilter: false,
					Schema:                 teamsSchema,
				})

				if err != nil {
					if e, ok := err.(*googleapi.Error); ok && e.Code == http.StatusConflict {
						// already exists
					} else {
						return errors.Wrap(err, "creating teams table")
					}
				}

				vacanciesSchema, err := bigquery.InferSchema(VacancyExport{})

				if err != nil {
					return errors.Wrap(err, "inferring vacancies schema")
				}

				err = vacanciesTable.Create(ctx, &bigquery.TableMetadata{
					Name:                   "Vacancies",
					Description:            "holds vacancies per team",
					TimePartitioning:       &bigquery.TimePartitioning{},
					RequirePartitionFilter: false,
					Schema:                 vacanciesSchema,
				})

				if err != nil {
					if e, ok := err.(*googleapi.Error); ok && e.Code == http.StatusConflict {
						// already exists
					} else {
						return errors.Wrap(err, "creating vacancies table")
					}
				}

				orgChart, err := loadOrgChartData(c.String("data-url"))

				if err != nil {
					return errors.Wrap(err, "retrieving org chart data")
				}

				employeesInserter := employeesTable.Inserter()

				if err := employeesInserter.Put(ctx, orgChart.employeeExports()); err != nil {
					return errors.Wrap(err, "inserting employees")
				}

				teamsInserter := teamsTable.Inserter()

				if err := teamsInserter.Put(ctx, orgChart.teamExports()); err != nil {
					return errors.Wrap(err, "inserting teams")
				}

				vacanciesInserter := vacanciesTable.Inserter()

				if err := vacanciesInserter.Put(ctx, orgChart.vacanciesExports()); err != nil {
					return errors.Wrap(err, "inserting vacancies")
				}

				return nil
			},
		},
		{
			Name: "json-export-employees",
			Flags: []cli.Flag{
				cli.StringFlag{
					Name: "data-url",
				},
				cli.StringFlag{
					Name: "output-file",
				},
				cli.BoolFlag{
					Name: "json",
				},
				cli.BoolFlag{
					Name: "csv",
				},
			},
			Action: func(c *cli.Context) error {
				logrus.SetLevel(logrus.DebugLevel)

				orgChart, err := loadOrgChartData(c.String("data-url"))

				if err != nil {
					return errors.Wrap(err, "retrieving org chart data")
				}

				var outputWriter io.Writer

				outputWriter = os.Stdout

				decoder := json.NewEncoder(outputWriter)

				if c.Bool("csv") {

					b, err := csvutil.Marshal(orgChart.employeeExports())

					if err != nil {
						return errors.Wrap(err, "writing output")
					}

					outputWriter.Write(b)
					return nil

				}

				for _, e := range orgChart.employeeExports() {

					err := decoder.Encode(e)

					if err != nil {
						return errors.Wrap(err, "writing output")
					}
				}

				return nil
			},
		},
		{
			Name: "json-export-teams",
			Flags: []cli.Flag{
				cli.StringFlag{
					Name: "data-url",
				},
				cli.StringFlag{
					Name: "output-file",
				},
				cli.BoolFlag{
					Name: "json",
				},
				cli.BoolFlag{
					Name: "csv",
				},
			},
			Action: func(c *cli.Context) error {
				logrus.SetLevel(logrus.DebugLevel)

				orgChart, err := loadOrgChartData(c.String("data-url"))

				if err != nil {
					return errors.Wrap(err, "retrieving org chart data")
				}

				var outputWriter io.Writer

				outputWriter = os.Stdout

				if c.Bool("csv") {

					b, err := csvutil.Marshal(orgChart.teamExports())

					if err != nil {
						return errors.Wrap(err, "writing output")
					}

					outputWriter.Write(b)
					return nil

				}

				decoder := json.NewEncoder(outputWriter)

				for _, e := range orgChart.teamExports() {
					err := decoder.Encode(e)

					if err != nil {
						return errors.Wrap(err, "writing output")
					}
				}

				return nil
			},
		},
		{
			Name: "gh-sync",
			Flags: []cli.Flag{
				cli.StringFlag{
					Name: "data-url",
				},
				cli.StringFlag{
					Name:   "github-token",
					EnvVar: "GITHUB_TOKEN",
				},
				cli.StringFlag{
					Name: "github-org",
				},
				cli.StringFlag{
					Name:  "github-team-prefix",
					Value: "org-",
				},
				cli.BoolFlag{
					Name: "dry-run",
				},
				cli.BoolFlag{
					Name: "skip-members",
				},
			},
			Action: func(c *cli.Context) error {

				logrus.SetLevel(logrus.DebugLevel)

				orgChart, err := loadOrgChartData(c.String("data-url"))

				if err != nil {
					return errors.Wrap(err, "retrieving org chart data")
				}

				for _, t := range orgChart.Teams {
					t.Github = fmt.Sprintf("%s%s", c.String("github-team-prefix"), strings.Replace(t.ID, "_", "-", -1))
					if t.ParentID != "" {
						t.ParentGithubID = fmt.Sprintf("%s%s", c.String("github-team-prefix"), strings.Replace(t.ParentID, "_", "-", -1))
					}
				}

				gh, err := newGithubState(c.String("github-token"), c.String("github-org"), c.String("github-team-prefix"))

				if err != nil {
					return errors.Wrap(err, "retrieving github data")
				}

				gh.dry = c.Bool("dry-run")

				if gh.dry {
					logrus.Info("running in DRY mode")
				}

				if c.Bool("skip-members") {
					logrus.Infof("skipping members sync")
				}

				for _, m := range githubMembersNotInOrgchart(orgChart, gh) {
					logrus.Infof("github user %s not found in orgchart", m.GetLogin())
				}

				for _, m := range employeesNotInGithub(orgChart, gh) {
					logrus.Infof("employee %s (%s) not found in github, will be added", m.Name, m.Github)
				}

				for _, t := range githubTeamsNotInOrgchart(orgChart, gh) {
					logrus.Infof("github team %s not found in orgchart, will be removed", t.GetName())
				}

				for _, m := range teamsNotInGithub(orgChart, gh) {
					logrus.Infof("team %s (%s) not found in github, will be added", m.Name, m.Github)
				}

				result, err := gh.SyncTeams(orgChart, c.Bool("skip-members"))

				if err != nil {
					return errors.Wrap(err, "syncing teams")
				}

				for _, team := range result.createdTeams {
					logrus.Infof("created %s in github", team.GetName())
				}

				for _, team := range result.reparentedTeams {
					logrus.Infof("reparented %s in github", team.GetName())
				}

				for _, team := range result.removedTeams {
					logrus.Infof("removed %s from github", team.GetName())
				}

				for _, employee := range result.unableToCreateMembership {
					logrus.Infof("unable to add member %s to %s team, github handle not provided", employee.Name, employee.MemberOf)
				}

				for _, employee := range result.unableToCreateMaintainer {
					logrus.Infof("unable to add maintainer %s to %s team, github handle not provided", employee.Name, employee.MemberOf)
				}

				return nil

			},
		},
	}

	err := app.Run(os.Args)

	if err != nil {
		logrus.Fatal(err)
	}

}

type Employee struct {
	ID        string
	Name      string
	Github    string
	MemberOf  string
	Team      *Team
	Stream    string
	Type      string
	ReportsTo string
}

type EmployeeExport struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Stream    string `json:"stream"`
	Type      string `json:"type"`
	Team      string `json:"team"`
	Reporting string `json:"reporting"`
}

type Team struct {
	ID             string
	Name           string
	ParentID       string `json:"parent"`
	Description    string
	Github         string
	ParentGithubID string
	TeachLeadID    string `json:"techLead"`
	ProductLeadID  string `json:"productLead"`
	Vacancies      map[string]int
	Backfills      map[string]int
}

type TeamExport struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Parents       string `json:"parents"`
	TeachLeadID   string `json:"techLead"`
	ProductLeadID string `json:"productLead"`
}

type VacancyExport struct {
	Type   string `json:"type"`
	TeamID string `json:"team"`
	Stream string `json:"stream"`
	Count  int    `json:"count"`
}

type OrgChart struct {
	Employees     []*Employee
	Teams         []*Team
	TeamsByID     map[string]*Team
	EmployeesByID map[string]*Employee
}

func (oc *OrgChart) vacanciesExports() []*VacancyExport {
	vacs := make([]*VacancyExport, 0, 0)
	streams := []string{"engineering", "product", "operations", "portfolio", "design"}

	for _, t := range oc.Teams {
		for _, s := range streams {
			if v := oc.vacancies(t, s); v > 0 {
				vacs = append(vacs, &VacancyExport{
					Type:   "new",
					TeamID: t.ID,
					Stream: s,
					Count:  v,
				})
			}
			if v := oc.backfills(t, s); v > 0 {
				vacs = append(vacs, &VacancyExport{
					Type:   "backfill",
					TeamID: t.ID,
					Stream: s,
					Count:  v,
				})
			}
		}
	}
	return vacs
}

func (oc *OrgChart) employeeExports() []*EmployeeExport {
	empls := []*EmployeeExport{}
	for _, e := range oc.Employees {
		empls = append(empls, &EmployeeExport{
			ID:        e.ID,
			Name:      e.Name,
			Stream:    e.Stream,
			Type:      e.Type,
			Team:      oc.teamAncestryString(e.Team, true),
			Reporting: oc.reportingLine(e),
		})
	}
	return empls
}

func (oc *OrgChart) teamExports() []*TeamExport {
	tms := []*TeamExport{}
	for _, t := range oc.Teams {
		tms = append(tms, &TeamExport{
			ID:            t.ID,
			Name:          t.Name,
			Parents:       oc.teamAncestryString(t, false),
			TeachLeadID:   oc.techLead(t).ID,
			ProductLeadID: oc.productLead(t).ID,
		})
	}
	return tms
}

func (oc *OrgChart) vacancies(t *Team, stream string) int {
	vac := 0

	for s, i := range t.Vacancies {
		if stream == "" || strings.ToUpper(s) == strings.ToUpper(stream) {
			vac += i
		}
	}

	return vac
}

func (oc *OrgChart) backfills(t *Team, stream string) int {
	vac := 0

	for s, i := range t.Backfills {
		if stream == "" || strings.ToUpper(s) == strings.ToUpper(stream) {
			vac += i
		}
	}

	return vac
}

func (oc *OrgChart) techLead(t *Team) *Employee {
	if t.TeachLeadID != "" {
		return oc.EmployeesByID[t.TeachLeadID]
	}

	if t.ParentID == "" {
		return oc.EmployeesByID[ROOT_EMPLOYEE]
	}

	return oc.techLead(oc.TeamsByID[t.ParentID])
}

func (oc *OrgChart) productLead(t *Team) *Employee {

	if t.ProductLeadID != "" {
		return oc.EmployeesByID[t.ProductLeadID]
	}

	if t.ParentID == "" {
		return oc.EmployeesByID[ROOT_EMPLOYEE]
	}

	return oc.productLead(oc.TeamsByID[t.ParentID])
}

func (oc *OrgChart) reportingLine(e *Employee) string {

	var lead string

	if e.ReportsTo != "" {
		lead = e.ReportsTo
	}

	if e.ID == ROOT_EMPLOYEE {
		return ""
	}

	if lead == "" {

		if e.Stream == "ENGINEERING" || e.Stream == "OPERATIONS" {
			if e.ID == e.Team.TeachLeadID {
				lead = oc.techLead(oc.TeamsByID[e.Team.ParentID]).ID
			} else {
				lead = oc.techLead(e.Team).ID
			}
		} else {
			if e.ID == e.Team.ProductLeadID {
				lead = oc.productLead(oc.TeamsByID[e.Team.ParentID]).ID
			} else {
				lead = oc.productLead(e.Team).ID
			}
		}
	}

	upline := oc.reportingLine(oc.EmployeesByID[lead])

	if upline == "" {
		return lead
	}

	return fmt.Sprintf("%s::%s", upline, lead)

}

func (oc *OrgChart) teamAncestryString(t *Team, includeCurrent bool) string {
	path := []string{}

	parent := t

	for parent != nil {
		path = append(path, parent.ID)
		parent = oc.TeamsByID[parent.ParentID]
	}

	for i := len(path)/2 - 1; i >= 0; i-- {
		opp := len(path) - 1 - i
		path[i], path[opp] = path[opp], path[i]
	}

	if !includeCurrent {
		path = path[0 : len(path)-1]
	}
	return strings.Join(path, "::")
}

func (oc *OrgChart) organise() error {

	oc.TeamsByID = make(map[string]*Team)
	oc.EmployeesByID = make(map[string]*Employee)

	for _, t := range oc.Teams {
		oc.TeamsByID[t.ID] = t
	}

	for _, e := range oc.Employees {

		oc.EmployeesByID[e.ID] = e

		team, ok := oc.TeamsByID[e.MemberOf]

		if !ok {
			return errors.Errorf("could not find team %s for member %s", e.MemberOf, e.Name)
		}

		e.Team = team
	}

	return nil

}

func employeesNotInGithub(orgchart *OrgChart, gh *GithubState) []*Employee {

	notInGithub := []*Employee{}

	for _, employee := range orgchart.Employees {
		if employee.Github == "" {
			continue
		}

		found := false

		for _, ghMember := range gh.members {
			if employee.Github == ghMember.GetLogin() {
				found = true
				break
			}
		}

		if !found {
			notInGithub = append(notInGithub, employee)
		}
	}

	return notInGithub
}

func githubMembersNotInOrgchart(orgchart *OrgChart, gh *GithubState) []*github.User {
	notInOrgchart := []*github.User{}

	for _, ghMember := range gh.members {
		found := false
		for _, employee := range orgchart.Employees {
			if employee.Github == ghMember.GetLogin() {
				found = true
				break
			}
		}
		if !found {
			notInOrgchart = append(notInOrgchart, ghMember)
		}
	}

	return notInOrgchart
}

func teamsNotInGithub(orgchart *OrgChart, gh *GithubState) []*Team {

	notInGithub := []*Team{}

	for _, team := range orgchart.Teams {

		found := false

		for _, ghTeam := range gh.teams {
			if team.Github == ghTeam.GetName() {
				found = true
				break
			}
		}

		if !found {
			notInGithub = append(notInGithub, team)
		}
	}

	return notInGithub

}

func githubTeamsNotInOrgchart(orgchart *OrgChart, gh *GithubState) []*github.Team {
	notInOrgchart := []*github.Team{}

	for _, ghTeam := range gh.teams {
		found := false
		for _, team := range orgchart.Teams {
			if team.Github == ghTeam.GetName() {
				found = true
				break
			}
		}
		if !found {
			notInOrgchart = append(notInOrgchart, ghTeam)
		}
	}

	return notInOrgchart
}

func newGithubState(token, organisation, teamPrefix string) (*GithubState, error) {

	client := newGitHubClient(token)

	gh := &GithubState{
		organisation: organisation,
		teamPrefix:   teamPrefix,
		client:       client,
		teams:        make(map[string]*github.Team),
		members:      []*github.User{},
	}

	ctx := context.Background()

	memberOpt := &github.ListMembersOptions{
		ListOptions: github.ListOptions{PerPage: 500},
	}

	for {
		members, res, err := client.Organizations.ListMembers(ctx, organisation, memberOpt)

		if err != nil {
			return nil, err
		}

		gh.AddMembers(members...)

		if res.NextPage == 0 {
			break
		}

		memberOpt.Page = res.NextPage
	}

	teamsOpt := &github.ListOptions{PerPage: 500}

	for {
		teams, res, err := client.Teams.ListTeams(ctx, organisation, teamsOpt)

		if err != nil {
			return nil, err
		}

		for _, t := range teams {
			if strings.HasPrefix(t.GetName(), teamPrefix) {
				gh.AddTeam(t)
			}
		}

		if res.NextPage == 0 {
			break
		}

		teamsOpt.Page = res.NextPage
	}

	return gh, nil
}

type githubSyncResult struct {
	removedTeams             []*github.Team
	createdTeams             []*github.Team
	reparentedTeams          []*github.Team
	unableToCreateMembership []*Employee
	unableToCreateMaintainer []*Employee
}

type GithubState struct {
	organisation string
	teamPrefix   string
	client       *github.Client
	teams        map[string]*github.Team
	members      []*github.User
	syncResult   *githubSyncResult
	dry          bool
	orgTeams     []*Team
}

func (gh *GithubState) AddTeam(team *github.Team) {
	gh.teams[team.GetName()] = team
}

func (gh *GithubState) AddMembers(member ...*github.User) {
	gh.members = append(gh.members, member...)
}

func (gh *GithubState) createTeamByIDIfNotExists(teamID string) (*github.Team, error) {

	var teamToCreate *Team

	for _, team := range gh.orgTeams {
		if team.ID == teamID {
			teamToCreate = team
		}
	}

	if teamToCreate == nil {
		return nil, errors.Errorf("could not find org team %s for creation", teamID)
	}

	var parentID *int64
	var parentTeam *github.Team

	if teamToCreate.ParentID != "" {
		var err error
		parentTeam, err = gh.createTeamByIDIfNotExists(teamToCreate.ParentID)
		if err != nil {
			return nil, err
		}
		parentID = parentTeam.ID
	}

	privacy := "closed"

	ctx := context.Background()

	if preExistingTeam, ok := gh.teams[teamToCreate.Github]; ok {
		if parentTeam := preExistingTeam.GetParent(); parentTeam != nil {
			if parentTeam.GetName() != teamToCreate.ParentGithubID {

				//logrus.Println("team considered: ", teamToCreate.Github, "github parent", parentTeam.GetName(), "defined parent", teamToCreate.ParentGithubID)

				var editedTeam *github.Team

				if !gh.dry {

					var err error

					editedTeam, _, err = gh.client.Teams.EditTeam(ctx, preExistingTeam.GetID(), github.NewTeam{
						Name:         teamToCreate.Github,
						Description:  &teamToCreate.Description,
						ParentTeamID: parentID,
						Privacy:      &privacy,
					})

					if err != nil {
						return nil, errors.Wrap(err, "editing team")
					}

				} else {
					editedTeam = preExistingTeam
				}

				gh.syncResult.reparentedTeams = append(gh.syncResult.reparentedTeams, editedTeam)

				gh.teams[editedTeam.GetName()] = editedTeam

			}
		}
		return preExistingTeam, nil
	}

	var createdTeam *github.Team

	if gh.dry {

		id := rand.Int63()

		createdTeam = &github.Team{
			ID:          &id,
			Name:        &teamToCreate.Github,
			Description: &teamToCreate.Description,
			Privacy:     &privacy,
			Parent:      parentTeam,
		}
	} else {

		var err error

		createdTeam, _, err = gh.client.Teams.CreateTeam(ctx, gh.organisation, github.NewTeam{
			Name:         teamToCreate.Github,
			Description:  &teamToCreate.Description,
			ParentTeamID: parentID,
			Privacy:      &privacy,
		})

		if err != nil {
			return nil, err
		}
	}

	gh.syncResult.createdTeams = append(gh.syncResult.createdTeams, createdTeam)
	gh.teams[createdTeam.GetName()] = createdTeam

	return createdTeam, nil

}

func (gh *GithubState) removeTeam(team *github.Team) error {

	if !gh.dry {

		_, err := gh.client.Teams.DeleteTeam(context.Background(), team.GetID())

		if err != nil {
			return nil
		}

	}

	gh.syncResult.removedTeams = append(gh.syncResult.removedTeams, team)

	delete(gh.teams, team.GetName())

	return nil
}

type teamMembershipSync struct {
	Maintainers []string
	Members     []string
}

func teamMembersSyncData(chart *OrgChart, gh *GithubState) (map[*github.Team]*teamMembershipSync, error) {

	memberSync := map[*github.Team]*teamMembershipSync{}

	for _, e := range chart.Employees {

		if e.Github == "" {
			gh.syncResult.unableToCreateMembership = append(gh.syncResult.unableToCreateMembership, e)
			continue
		}

		team, ok := gh.teams[e.Team.Github]

		if !ok {
			return nil, errors.Errorf("team %s not found in github", e.Team.Github)
		}

		if _, ok := memberSync[team]; !ok {
			memberSync[team] = &teamMembershipSync{
				Maintainers: []string{},
				Members:     []string{},
			}
		}

		memberSync[team].Members = append(memberSync[team].Members, e.Github)
	}

	for _, t := range chart.Teams {

		team, ok := gh.teams[t.Github]

		if !ok {
			return nil, errors.Errorf("team %s not found in github", t.Github)
		}

		if _, ok := memberSync[team]; !ok {
			memberSync[team] = &teamMembershipSync{
				Maintainers: []string{},
				Members:     []string{},
			}
		}

		if t.TeachLeadID != "" {
			techLead, ok := chart.EmployeesByID[t.TeachLeadID]

			if !ok {
				return nil, errors.Errorf("could not find tech lead %s for team %s", t.TeachLeadID, t.Name)
			}

			if techLead.Github == "" {
				gh.syncResult.unableToCreateMaintainer = append(gh.syncResult.unableToCreateMaintainer, techLead)
				continue
			}

			memberSync[team].Maintainers = append(memberSync[team].Maintainers, techLead.Github)
		}

		if t.ProductLeadID != "" {
			productLead, ok := chart.EmployeesByID[t.ProductLeadID]

			if !ok {
				return nil, errors.Errorf("could not find product lead %s for team %s", t.TeachLeadID, t.Name)
			}

			if productLead.Github == "" {
				gh.syncResult.unableToCreateMaintainer = append(gh.syncResult.unableToCreateMaintainer, productLead)
				continue
			}

			memberSync[team].Maintainers = append(memberSync[team].Maintainers, productLead.Github)
		}
	}

	return memberSync, nil

}

func (gh *GithubState) SyncTeams(chart *OrgChart, skipMembers bool) (*githubSyncResult, error) {

	gh.orgTeams = chart.Teams

	gh.syncResult = &githubSyncResult{
		[]*github.Team{},
		[]*github.Team{},
		[]*github.Team{},
		[]*Employee{},
		[]*Employee{},
	}

	for _, teamToRemove := range githubTeamsNotInOrgchart(chart, gh) {
		err := gh.removeTeam(teamToRemove)

		if err != nil {
			return gh.syncResult, err
		}
	}

	for _, teamToCreate := range chart.Teams {
		//for _, teamToCreate := range teamsNotInGithub(chart, gh) { //commented because we want to sync parents in all teams
		_, err := gh.createTeamByIDIfNotExists(teamToCreate.ID)

		if err != nil {
			return gh.syncResult, err
		}
	}

	syncData, err := teamMembersSyncData(chart, gh)

	if err != nil {
		return gh.syncResult, err
	}

	if skipMembers {
		return gh.syncResult, nil
	}

	for ghTeam, membership := range syncData {
		err := gh.syncTeamMembers(ghTeam, membership.Members, membership.Maintainers)

		if err != nil {
			return gh.syncResult, err
		}
	}

	return gh.syncResult, nil

}

func (gh *GithubState) getTeamMembers(team *github.Team) ([]*github.User, error) {

	ctx := context.Background()

	memberOpt := &github.TeamListTeamMembersOptions{
		ListOptions: github.ListOptions{PerPage: 500},
	}

	allMembers := []*github.User{}

	for {

		loc := fmt.Sprintf("teams/%v/members", team.GetID())

		u, err := url.Parse(loc)

		if err != nil {
			return nil, err
		}

		q, err := query.Values(memberOpt)

		if err != nil {
			return nil, err
		}

		u.RawQuery = q.Encode()

		req, err := gh.client.NewRequest("GET", u.String(), nil)

		if err != nil {
			return nil, err
		}

		var members []*github.User
		res, err := gh.client.Do(ctx, req, &members)

		if err != nil {
			return nil, err
		}

		allMembers = append(allMembers, members...)

		if res.NextPage == 0 {
			break
		}

		memberOpt.Page = res.NextPage
	}

	return allMembers, nil
}

func (gh *GithubState) removeAllTeamMembers(team *github.Team) error {
	logrus.Infof("removing members for %s", team.GetName())

	if gh.dry {
		return nil
	}

	ctx := context.Background()

	memberOpt := &github.TeamListTeamMembersOptions{
		ListOptions: github.ListOptions{PerPage: 500},
	}

	allMembers := []*github.User{}

	for {
		members, res, err := gh.client.Teams.ListTeamMembers(ctx, team.GetID(), memberOpt)

		if err != nil {
			return err
		}

		allMembers = append(allMembers, members...)

		if res.NextPage == 0 {
			break
		}

		memberOpt.Page = res.NextPage
	}

	for _, member := range allMembers {
		_, err := gh.client.Teams.RemoveTeamMembership(ctx, team.GetID(), member.GetLogin())

		if err != nil {
			return err
		}
	}

	return nil
}

func (gh *GithubState) syncTeamMembers(team *github.Team, memberHandles []string, maintainerHandles []string) error {

	//logrus.Infof("syncing members and maintainers for %s", team.GetName())

	allMembers := append(memberHandles, maintainerHandles...)

	currentMembers, err := gh.getTeamMembers(team)

	if err != nil {
		return err
	}

	membersToAdd := []string{}
	membersToRemove := []string{}

OUTER:
	for _, ghMember := range currentMembers {
		for _, member := range allMembers {
			if ghMember.GetLogin() == member {
				continue OUTER
			}
		}
		membersToRemove = append(membersToRemove, ghMember.GetLogin())
	}

OUTER2:
	for _, member := range allMembers {
		for _, ghMember := range currentMembers {
			if ghMember.GetLogin() == member {
				continue OUTER2
			}
		}
		membersToAdd = append(membersToAdd, member)
	}

	ctx := context.Background()

	for _, user := range membersToRemove {

		logrus.Debugf("removing %s from %s", user, team.GetName())

		if gh.dry {
			continue
		}

		_, err := gh.client.Teams.RemoveTeamMembership(ctx, team.GetID(), user)

		if err != nil {
			return err
		}

	}

	for _, user := range membersToAdd {

		logrus.Debugf("adding %s  to %s", user, team.GetName())

		if gh.dry {
			continue
		}

		_, _, err := gh.client.Teams.AddTeamMembership(ctx, team.GetID(), user, nil)

		if err != nil {
			return err
		}

	}

	return nil
}

func newGitHubClient(token string) *github.Client {
	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: token},
	)

	ctx := context.Background()

	tc := oauth2.NewClient(ctx, ts)

	return github.NewClient(tc)
}

func loadOrgChartData(location string) (*OrgChart, error) {

	URL, err := url.Parse(location)

	if err != nil {
		return nil, err
	}

	var chart OrgChart

	couchdb := couch.NewClient(URL)

	err = couchdb.Get("chart", &chart)

	if err != nil {
		return nil, err
	}

	err = chart.organise()

	if err != nil {
		return nil, err
	}

	return &chart, nil

}
