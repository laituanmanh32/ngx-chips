import {
    Component,
    forwardRef,
    Input,
    Output,
    ElementRef,
    EventEmitter,
    Renderer,
    ViewChild,
    ViewChildren,
    ContentChildren,
    ContentChild,
    OnInit,
    HostListener,
    TemplateRef,
    QueryList
} from '@angular/core';

import {
    FormControl,
    NG_VALUE_ACCESSOR
} from '@angular/forms';

import {
    PLACEHOLDER,
    SECONDARY_PLACEHOLDER,
    KEYDOWN,
    KEYUP,
    MAX_ITEMS_WARNING
} from './helpers/constants';

import {
    backSpaceListener,
    autoCompleteListener,
    customSeparatorKeys,
    addListener,
    onAutocompleteItemClicked
} from './helpers/events-actions';

import { TagInputAccessor, TagModel } from './helpers/accessor';
import { getAction } from './helpers/keypress-actions';
import { TagInputForm } from './tag-input-form/tag-input-form.component';

import 'rxjs/add/operator/debounceTime';
import { TagInputDropdown } from './dropdown/tag-input-dropdown.component';
import { TagComponent } from './tag/tag.component';

/**
 * A component for entering a list of terms to be used with ngModel.
 */
@Component({
    selector: 'tag-input',
    providers: [ {
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => TagInputComponent),
        multi: true
    } ],
    styleUrls: [ './tag-input.style.scss' ],
    templateUrl: './tag-input.template.html'
})
export class TagInputComponent extends TagInputAccessor implements OnInit {
    /**
     * @name separatorKeys
     * @desc keyboard keys with which a user can separate items
     * @type {Array}
     */
    @Input() public separatorKeys: number[] = [];

    /**
     * @name placeholder
     * @desc the placeholder of the input text
     * @type {string}
     */
    @Input() public placeholder: string = PLACEHOLDER;

    /**
     * @name secondaryPlaceholder
     * @desc placeholder to appear when the input is empty
     * @type {string}
     */
    @Input() public secondaryPlaceholder: string = SECONDARY_PLACEHOLDER;

    /**
     * @name maxItems
     * @desc maximum number of items that can be added
     * @type {number}
     */
    @Input() public maxItems: number = undefined;

    /**
     * @name readonly
     * @desc if set to true, the user cannot remove/addItem new items
     * @type {boolean}
     */
    @Input() public readonly: boolean = undefined;

    /**
     * @name transform
     * @desc function passed to the component to transform the value of the items, or reject them instead
     */
    @Input() public transform: (item: string) => string = (item) => item;

    /**
     * @name validators
     * @desc array of Validators that are used to validate the tag before it gets appended to the list
     * @type {Validators[]}
     */
    @Input() public validators = [];

    /**
     * @name autocompleteItems
     * @desc array of items that will populate the autocomplete
     * @type {Array<string>}
     */
    @Input() public autocompleteItems: string[] = undefined;

    /**
    * - if set to true, it will only possible to add items from the autocomplete
    * @name onlyFromAutocomplete
    * @type {Boolean}
    */
    @Input() public onlyFromAutocomplete: boolean = false;

	/**
     * @name errorMessages
     * @type {Map<string, string>}
     */
    @Input() public errorMessages: {[key: string]: string} = {};

    /**
     * @name theme
     * @type {string}
     */
    @Input() public theme: string = 'default';

    /**
     * - show autocomplete dropdown if the value of input is empty
     * @name showDropdownIfEmpty
     * @type {boolean}
     */
    @Input() public showDropdownIfEmpty: boolean = false;

    // outputs

    /**
     * @name onTextChangeDebounce
     * @type {number}
     */
    @Input() private onTextChangeDebounce: number = 250;

    /**
     * - custom id assigned to the input
     * @name id
     */
    @Input() private inputId: string;

    /**
     * - custom class assigned to the input
     */
    @Input() private inputClass: string;

    /**
     * - option to clear text input when the form is blurred
     * @name clearOnBlur
     */
    @Input() private clearOnBlur: string;

    /**
     * - hideForm
     * @name clearOnBlur
     */
    @Input() private hideForm: string;

    /**
     * @name addOnBlur
     */
    @Input() private addOnBlur: boolean;

    /**
     * @name addOnPaste
     */
    @Input() private addOnPaste: boolean;

    /**
     * - pattern used with the native method split() to separate patterns in the string pasted
     * @name pasteSplitPattern
     */
    @Input() private pasteSplitPattern: string = ',';

    /**
     * @name blinkIfDupe
     * @type {boolean}
     */
    @Input() private blinkIfDupe: boolean = true;

    /**
     * @name onAdd
     * @desc event emitted when adding a new item
     * @type {EventEmitter<string>}
     */
    @Output() public onAdd = new EventEmitter<TagModel>();

    /**
     * @name onRemove
     * @desc event emitted when removing an existing item
     * @type {EventEmitter<string>}
     */
    @Output() public onRemove = new EventEmitter<TagModel>();

    /**
     * @name onSelect
     * @desc event emitted when selecting an item
     * @type {EventEmitter<string>}
     */
    @Output() public onSelect = new EventEmitter<TagModel>();

    /**
     * @name onFocus
     * @desc event emitted when the input is focused
     * @type {EventEmitter<string>}
     */
    @Output() public onFocus = new EventEmitter<string>();

    /**
     * @name onFocus
     * @desc event emitted when the input is blurred
     * @type {EventEmitter<string>}
     */
    @Output() public onBlur = new EventEmitter<string>();

    /**
     * @name onTextChange
     * @desc event emitted when the input value changes
     * @type {EventEmitter<string>}
     */
    @Output() public onTextChange = new EventEmitter<TagModel>();

    /**
     * - output triggered when text is pasted in the form
     * @name onPaste
     * @type {EventEmitter<TagModel>}
     */
    @Output() public onPaste = new EventEmitter<string>();

    /**
     * - output triggered when tag entered is not valid
     * @name onValidationError
     * @type {EventEmitter<string>}
     */
    @Output() public onValidationError = new EventEmitter<string>();

    /**
     * @name dropdown
     */
    @ContentChild(TagInputDropdown) public dropdown: TagInputDropdown;

    /**
     * @name template
     * @desc reference to the template if provided by the user
     * @type {TemplateRef}
     */
    @ContentChildren(TemplateRef, {descendants: false}) public templates: QueryList<TemplateRef<any>>;

	/**
     * @name inputForm
     * @type {TagInputForm}
     */
    @ViewChild(TagInputForm) public inputForm: TagInputForm;

    /**
    * list of items that match the current value of the input (for autocomplete)
    * @name itemsMatching
    * @type {String[]}
    */
    public itemsMatching: string[] = [];

    /**
     * @name selectedTag
     * @desc reference to the current selected tag
     * @type {String}
     */
    public selectedTag: TagModel;

    /**
     * @name tags
     * @desc list of Element items
     */
    @ViewChildren(TagComponent) private tags: QueryList<TagComponent>;

    /**
     * @name listeners
     * @desc array of events that get fired using @fireEvents
     * @type []
     */
    private listeners = {
        [KEYDOWN]: <{(fun): any}[]>[],
        [KEYUP]: <{(fun): any}[]>[],
        change: <{(fun): any}[]>[]
    };

    constructor(private element: ElementRef, private renderer: Renderer) {
        super();
    }

    /**
     * @name removeItem
     * @desc removes an item from the array of the model
     * @param item {string}
     */
    public removeItem(item: TagModel): void {
        this.items = this.items.filter(_item => _item !== this.findItem(this.getTagValue(item)));

        // if the removed tag was selected, set it as undefined
        if (this.selectedTag && this.getTagValue(this.selectedTag) === this.getTagValue(item)) {
            this.selectedTag = undefined;
        }

        // focus input right after removing an item
        this.focus(true);

        // emit remove event
        this.onRemove.emit(item);
    }

    /**
     * @name addItem
     * @desc adds the current text model to the items array
     */
    public addItem(isFromAutocomplete = false): void {
        // update form value with the transformed item
        const item = this.setInputValue(this.inputForm.value.value);
        const isInputValid = this.inputForm.form.valid;

        if (!isInputValid) {
            return;
        }

        const isValid = this.isTagValid(item, isFromAutocomplete);

        // if valid:
        if (isValid) {
            this.appendNewTag(item);
        } else {
            this.onValidationError.emit(item);
        }

        // reset control
        this.setInputValue('');
        this.focus(true);
    }

    /**
     *
     * @param value
     * @param isFromAutocomplete
     */
    public isTagValid(value: string, isFromAutocomplete = false): boolean {
        const selectedItem = this.dropdown ? this.dropdown.selectedItem : undefined;
        if (selectedItem && !isFromAutocomplete) {
            return;
        }

        // check validity:
        // 1. there must be no dupe

        // check if the transformed item is already existing in the list
        const dupe = this.findItem(value);

        // if so, give a visual cue and return false
        if (!!dupe && this.blinkIfDupe) {
            const item = this.tags.find(item => item.model === dupe);
            item.blink();
        }

        // 2. check max items has not been reached
        // 3. check item comes from autocomplete
        // 4. or onlyFromAutocomplete is false
        return !dupe && !this.maxItemsReached &&
            ((isFromAutocomplete && this.onlyFromAutocomplete) || !this.onlyFromAutocomplete);
    }

    /**
     * @name appendNewTag
     * @param item
     */
    public appendNewTag(item: string): void {
        const newTag = new TagModel(item, item);

        // append item to the ngModel list
        this.items = [...this.items, newTag];

        //  and emit event
        this.onAdd.emit(newTag);
    }

    /**
     * @name selectItem
     * @desc selects item passed as parameter as the selected tag
     * @param item
     */
    public selectItem(item: TagModel): void {
        if (this.readonly || !item || item === this.selectedTag) {
            return;
        }

        this.selectedTag = item;

        // emit event
        this.onSelect.emit(item);
    }

    /**
     * @name findItem
     * @param value
     * @returns {TagModel}
     */
    public findItem(value: string): TagModel {
        return this.items.find((item: TagModel) => item.value === value);
    }

    /**
     * @name fireEvents
     * @desc goes through the list of the events for a given eventName, and fires each of them
     * @param eventName
     * @param $event
     */
    public fireEvents(eventName: string, $event?): void {
        this.listeners[eventName].forEach(listener => listener.call(this, $event));
    }

    /**
     * @name handleKeydown
     * @desc handles action when the user hits a keyboard key
     * @param data
     */
    public handleKeydown(data: any): void {
        const event = data.event;
        const action = getAction(event.keyCode || event.which);

        // call action
        action.call(this, data.model);

        // prevent default behaviour
        event.preventDefault();
    }

    /**
     * @name seyInputValue
     * @param value
     * @returns {string}
     */
    private setInputValue(value: string): string {
        const item = value ? this.transform(value) : '';
        const control = this.getControl();

        // update form value with the transformed item
        control.setValue(item);

        return item;
    }

    /**
     * @name getControl
     * @returns {FormControl}
     */
    private getControl(): FormControl {
        return <FormControl>this.inputForm.value;
    }

	/**
     * @name focus
     * @param applyFocus
     */
    public focus(applyFocus = false): void {
        if (this.readonly) {
            return;
        }

        if (this.dropdown) {
            autoCompleteListener.call(this, {});
        }

        this.selectedTag = undefined;

        this.onFocus.emit(this.inputForm.value.value);

        if (applyFocus) {
            this.inputForm.focus();
        }
    }

	/**
     * @name blur
     */
    public blur(): void {
        this.onBlur.emit(this.inputForm.value.value);
    }

    /**
     * @name hasErrors
     * @returns {boolean}
     */
    public hasErrors(): boolean {
        return this.inputForm && this.inputForm.hasErrors() ? true : false;
    }

    /**
     * @name isInputFocused
     * @returns {boolean}
     */
    public isInputFocused(): boolean {
        return this.inputForm && this.inputForm.isInputFocused() ? true : false;
    }

    /**
     * - this is the one way I found to tell if the template has been passed and it is not
     * the template for the menu item
     * @name hasCustomTemplate
     */
    public hasCustomTemplate(): boolean {
        const template = this.templates ? this.templates.first : undefined;
        const menuTemplate = this.dropdown && this.dropdown.templates ? this.dropdown.templates.first : undefined;
        return template && template !== menuTemplate;
    }

	/**
     * @name maxItemsReached
     * @returns {boolean}
     */
    private get maxItemsReached(): boolean {
        return this.maxItems !== undefined && this.items.length >= this.maxItems;
    }

    /**
     * - helper to take value of a model; mostly for trackBy because it will only accept a function
     * @name getTagValue
     * @param item
     * @returns {string}
     */
    private getTagValue(item: TagModel): string {
        return item ? item.value : undefined;
    }

    /**
     * @name onPasteCallback
     * @param data
     */
    private onPasteCallback(data: ClipboardEvent) {
        const text = data.clipboardData.getData('text/plain');

        text.split(this.pasteSplitPattern)
            .map(item => new TagModel(item, item))
            .forEach(item => {
                const value = this.transform(this.getTagValue(item));
                if (this.isTagValid(value)) {
                    this.appendNewTag(value);
                }
            });

        this.onPaste.emit(text);

        setTimeout(() => this.setInputValue(''), 0);
    }

    /**
     * @name ngOnInit
     */
    public ngOnInit() {
        // setting up the keypress listeners
        addListener.call(this, KEYDOWN, backSpaceListener);
        addListener.call(this, KEYDOWN, customSeparatorKeys, this.separatorKeys.length > 0);

        // if the number of items specified in the model is > of the value of maxItems
        // degrade gracefully and let the max number of items to be the number of items in the model
        // though, warn the user.
        const maxItemsReached = this.maxItems !== undefined && this.items.length > this.maxItems;
        if (maxItemsReached) {
            this.maxItems = this.items.length;
            console.warn(MAX_ITEMS_WARNING);
        }
    }

    /**
     * @name ngAfterViewInit
     */
    public ngAfterViewInit() {
        this.inputForm.onKeydown.subscribe(event => {
            this.fireEvents('keydown', event);
        });

        if (this.onTextChange.observers.length) {
            this.inputForm.form.valueChanges
                .debounceTime(this.onTextChangeDebounce)
                .subscribe(() => {
                    const value = this.inputForm.value.value;
                    this.onTextChange.emit(value);
                });
        }

        // if clear on blur is set to true, subscribe to the event and clear the text's form
        if (this.clearOnBlur || this.addOnBlur) {
            this.inputForm
                .onBlur
                .subscribe(() => {
                    if (this.addOnBlur) {
                        this.addItem();
                    }

                    this.setInputValue('');
                });
        }

        // if addOnPaste is set to true, register the handler and add items
        if (this.addOnPaste) {
            const input = this.inputForm.input.nativeElement;

            // attach listener to input
            this.renderer.listen(input, 'paste', this.onPasteCallback.bind(this));
        }

        // if hideForm is set to true, remove the input
        if (this.hideForm) {
            this.inputForm.destroy();
        }
    }

    /**
     * @name ngAfterContentInit
     */
    public ngAfterContentInit() {
        // if dropdown is defined, set up its events
        if (this.dropdown) {
            addListener.call(this, KEYUP, autoCompleteListener);

            this.dropdown.onItemClicked().subscribe(onAutocompleteItemClicked.bind(this));

            // reset itemsMatching array when the dropdown is hidden
            this.dropdown.onHide().subscribe(() => {
                this.itemsMatching = [];
            });
        }
    }

    /**
     * @name scrollListener
     */
    @HostListener('window:scroll')
    private scrollListener(): void {
        if (this.dropdown && this.dropdown.isVisible) {
            this.dropdown.updatePosition(this.inputForm.getElementPosition());
        }
    }
}
