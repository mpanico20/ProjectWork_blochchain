// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title GestioneRecensioni
 * @dev Contratto per gestire inserimento, modifica e cancellazione di recensioni
 */
contract GestioneRecensioni {
    
    // Enumerazione per definire gli stati della recensione
    enum Stato {
        INSERITA,    
        MODIFICATA,  
        CANCELLATA   
    }
    
    struct Risposta {
        address hotel;
        string cidRisp;       // CID IPFS per il contenuto della risposta
        uint256 timestamp;    
    }

    // Struttura per memorizzare i dati di una recensione
    struct Recensione {
        string cidIPFS;             // CID IPFS della recensione
        string cidIPFS_2; 
        bool sentiment;             // true = positiva, false = negativa (non modificabile)
        uint256 timestampCreazione; // Timestamp di creazione
        Stato stato;                // Stato attuale della recensione
        bytes32 hashVC;             //Hash vc dell'hotel
    }

    address public admin;
 
    //mappa hash vc dell'hotel alla recensione
    mapping(bytes32 => Recensione) public recensioneHotel;
    
     // Mapping per tenere traccia delle recensioni per hotel
    mapping(address => bytes32[]) public recensioniPerHotel;

    
    // mapping per le risposte
     mapping(string => Risposta) public risposte;

    

    event RispostaInserita(string cidRecensione, string cidRisposta);
    // Costanti per la validazione
    uint256 public constant TEMPO_MODIFICA = 24 hours; // 24 ore in secondi
    
     // Eventi per tracciare le operazioni
    event RecensioneInserita(
        string cidIPFS,
        bool sentiment,
        address hotelAdd,
        uint256 timestamp
    );
    
    event RecensioneModificata(
        string nuovoCidIPFS,
        uint256 timestamp
    );

    /**
     * @dev Costruttore del contratto
     */
      constructor() {
        admin = msg.sender;
       }

    // Restringe alcune azioni solo all'admin
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

     /**
     * @dev Inserisce una nuova recensione
     * @param _cidIPFS CID IPFS della recensione
     * @param _sentiment Sentiment della recensione (true=positiva, false=negativa)
     * @param _hashVC hash della vc rilasciata dall'hotel
     * @param _hotelAdd address hotel
     */

     function inserisciRecensione(
        string memory _cidIPFS,
        bool _sentiment,
        bytes32 _hashVC, 
        address _hotelAdd
        ) public onlyAdmin {

         // Validazione del CID IPFS (non deve essere vuoto)
        require(bytes(_cidIPFS).length > 0, "CID IPFS non puo essere vuoto");
        require (recensioneHotel[_hashVC].timestampCreazione == 0, "Recensione gia inserita");
        //crea nuova recensione 
        recensioneHotel[_hashVC]= Recensione({
            cidIPFS: _cidIPFS,
            cidIPFS_2: "",
            sentiment: _sentiment,
            timestampCreazione: block.timestamp,
            stato: Stato.INSERITA,
            hashVC: _hashVC
        });

         // Collega l'hash alla lista dell'hotel
        recensioniPerHotel[_hotelAdd].push(_hashVC);
         // Emetti l'evento
        emit RecensioneInserita(
            _cidIPFS,
            _sentiment,
            _hotelAdd,
            block.timestamp
        );
    }
    /**
     * @dev Modificare una recensione
     * @param _hashVC hash della vc rilasciata dall'hotel
     * @param _nuovoCID nuovo cid della recensione
     */
    function modificaRecensione(bytes32 _hashVC, string memory _nuovoCID) public onlyAdmin {
        require(recensioneHotel[_hashVC].stato != Stato.CANCELLATA, "Recensione cancellata!");
        require(recensioneHotel[_hashVC].stato != Stato.MODIFICATA, "Recensione precedentemente modificata!");
        require(block.timestamp <= recensioneHotel[_hashVC].timestampCreazione + TEMPO_MODIFICA, "Tempo per la modifica scaduto");
        require(bytes(_nuovoCID).length > 0, "CID IPFS non puo essere vuoto");
        recensioneHotel[_hashVC].cidIPFS_2 = _nuovoCID;
        recensioneHotel[_hashVC].stato = Stato.MODIFICATA;

        emit RecensioneModificata(
            _nuovoCID,
            block.timestamp
        );
    }
    /**
     * @dev Eliminare una recensione
     * @param _hashVC hash della vc rilasciata dall'hotel
     */
     function eliminaRecensione(bytes32 _hashVC) public onlyAdmin returns (bool) {
        require(recensioneHotel[_hashVC].stato != Stato.CANCELLATA, "Recensione precedentemente cancellata!");
        recensioneHotel[_hashVC].stato = Stato.CANCELLATA;
        return true;
     }
    
    /**
     * @dev Cliente che vuole consultare recensioni di una struttura
     * @param _hotelAdd address dell'hotel di cui voglio vedere le recensioni
     * @return cids cid delle recensioni associate ad un hotel
     */
    function visualizzaRecensioniAttive(address _hotelAdd) public view returns (string[] memory){
        bytes32[] memory recensioni = recensioniPerHotel[_hotelAdd];
        uint256 l = recensioni.length;
        uint256 j;
        j = 0;
        for(uint256 i = 0; i<l; i++){
            if (recensioneHotel[recensioni[i]].stato == Stato.CANCELLATA){
                j++;
            }
        }
        string[] memory cids = new string[](l-j);
        j = 0;
        for(uint256 i = 0; i<l; i++){
            if(recensioneHotel[recensioni[i]].stato == Stato.MODIFICATA){
                cids[j] = recensioneHotel[recensioni[i]].cidIPFS_2;
                j++;
            }
            if(recensioneHotel[recensioni[i]].stato == Stato.INSERITA){
                cids[j] = recensioneHotel[recensioni[i]].cidIPFS;
                j++;
            }
        }
        return cids;
    }

    /**
     * @dev Hotel vuole accedere alle recensioni sulla propria struttura, anche eliminate
     * @param _hotelAdd address dell'hotel di cui voglio vedere le recensioni
     * @return cids cid delle recensioni associate ad un hotel
     */
    function visualizzaRecensioniHotel(address _hotelAdd) public view onlyAdmin returns (string[] memory) {
        bytes32[] memory recensioni = recensioniPerHotel[_hotelAdd];
        uint256 l = recensioni.length;
        string[] memory cids = new string[](l);
        for(uint256 i = 0; i<l; i++){
            if(recensioneHotel[recensioni[i]].stato == Stato.MODIFICATA){
                cids[i] = recensioneHotel[recensioni[i]].cidIPFS_2;
            } else if (recensioneHotel[recensioni[i]].stato == Stato.INSERITA){
                cids[i] = recensioneHotel[recensioni[i]].cidIPFS;
            }else if(recensioneHotel[recensioni[i]].stato == Stato.CANCELLATA){
                if(bytes(recensioneHotel[recensioni[i]].cidIPFS_2).length > 0){
                    cids[i] = recensioneHotel[recensioni[i]].cidIPFS_2;
                }else{
                    cids[i] = recensioneHotel[recensioni[i]].cidIPFS;
                }
            }
        }
        return cids;
    }

    function inserisciRisposta(
        string memory _cidIPFS,
        string memory _cidRisp,
        address _hotelAdd
        ) public onlyAdmin {
         // Validazione del CID IPFS (non deve essere vuoto)
        require (risposte[_cidIPFS].hotel == address(0), "Risposta gia inserita");
        require(bytes(_cidRisp).length > 0, "CID IPFS non puo essere vuoto");
        bytes32[] memory recensioni = recensioniPerHotel[_hotelAdd];
        uint256 l = recensioni.length;
        for (uint256 i = 0; i<l; i++){
            if(recensioneHotel[recensioni[i]].stato == Stato.MODIFICATA){
                if (keccak256(bytes(recensioneHotel[recensioni[i]].cidIPFS_2)) == keccak256(bytes (_cidIPFS))){
                risposte[_cidIPFS] = Risposta({
                hotel: _hotelAdd,
                cidRisp: _cidRisp,
                timestamp: block.timestamp
                });
                emit RispostaInserita(_cidIPFS, _cidRisp);
            }}
            else if(recensioneHotel[recensioni[i]].stato == Stato.INSERITA){
                    if (keccak256(bytes(recensioneHotel[recensioni[i]].cidIPFS)) == keccak256(bytes (_cidIPFS))){
                    risposte[_cidIPFS] = Risposta({
                    hotel: _hotelAdd,
                    cidRisp: _cidRisp,
                    timestamp: block.timestamp
                    });
                    emit RispostaInserita(_cidIPFS, _cidRisp);
                }
            }   
        }
    }
    function getRisposta(string memory _cidRecensione) public view returns (Risposta memory) {
        return risposte[_cidRecensione];
    }
}
